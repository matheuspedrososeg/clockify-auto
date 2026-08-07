import { useState } from 'react'
import { message } from 'antd'
import { GoogleGenAI } from "@google/genai"
import Anthropic from "@anthropic-ai/sdk"
import { useI18n } from '../i18n/useI18n'
import type {
    AppMode,
    CsvField,
    CsvMapping,
    OcrRow,
    SourceMode,
    TimeField,
    TimeSheetRow,
} from '../types/timesheet'
import type { IsoDate } from '../utils/dates'
import { MAX_RANGE_DAYS, daysInclusive, enumerateDays } from '../utils/dates'
import type { CsvTable } from '../utils/csv'
import { EMPTY_CSV_MAPPING, guessMapping, mapCsvRows, parseCsvFile } from '../utils/csv'
import { normalizeOcrRows } from '../utils/timesheet'
import { readKey, writeKey } from '../utils/keyStorage'

export type AIModel = 'gemini-3.5-flash' | 'claude-sonnet-4-6'

const COLUMN_NAMES = {
    date: "Data",
    morningCheckIn: "Marcações",
}

const PROMPT = `
    You are an OCR assistant.

    Read the spreadsheet in the image.

    The spreadsheet has two relevant columns.

    Map them as follows:

    -${COLUMN_NAMES.date} -> date
    - ${COLUMN_NAMES.morningCheckIn} -> morningCheckIn

    The ${COLUMN_NAMES.morningCheckIn} column, is responsible for holding the 4 time entries of the day. Map them in this order:
    morningCheckIn
    morningCheckOut
    afternoonCheckIn
    afternoonCheckOut

    Return ONLY valid JSON.

    The format MUST be exactly:

    [
    {
        "date": "12/08",
        "morningCheckIn": "08:00",
        "morningCheckOut": "12:00",
        "afternoonCheckIn": "13:00",
        "afternoonCheckOut": "17:00"
    }
    ]

    Rules:
    - One object per spreadsheet row.
    - Keep the values exactly as written.
    - Empty cells must become "".
    - Do not wrap the JSON inside markdown.
    - Do not explain anything.
    - If the ${COLUMN_NAMES.morningCheckIn} column does not have an appropriate format, skip that row.
`

const BLANK_TIMES = {
    morningCheckIn: '',
    morningCheckOut: '',
    afternoonCheckIn: '',
    afternoonCheckOut: '',
}

async function fileToBase64(file: File): Promise<string> {
    const bytes = await file.arrayBuffer()
    let binary = ""
    for (const b of new Uint8Array(bytes)) {
        binary += String.fromCharCode(b)
    }
    return btoa(binary)
}

async function transcribeWithGemini(apiKey: string, imageInBase64: string, mimeType: string): Promise<OcrRow[]> {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: [{
            parts: [
                { inlineData: { mimeType, data: imageInBase64 } },
                { text: PROMPT },
            ],
        }],
    })
    return JSON.parse(response.text ?? "")
}

async function transcribeWithClaude(apiKey: string, imageInBase64: string, mimeType: string): Promise<OcrRow[]> {
    const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{
            role: "user",
            content: [
                {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
                        data: imageInBase64,
                    },
                },
                { type: "text", text: PROMPT },
            ],
        }],
    })
    const text = response.content.find(b => b.type === "text")?.text ?? ""
    return JSON.parse(text)
}

export function useReport() {
    const { t } = useI18n()
    const [appMode, setAppModeState] = useState<AppMode>('recover')
    const [sourceMode, setSourceModeState] = useState<SourceMode>('image')
    const [rows, setRows] = useState<TimeSheetRow[] | null>(null)
    const [rowsVersion, setRowsVersion] = useState(0)
    const [loading, setLoading] = useState(false)
    const [selectedModel, setSelectedModel] = useState<AIModel>('gemini-3.5-flash')
    const [csvTable, setCsvTable] = useState<CsvTable | null>(null)
    const [csvFileName, setCsvFileName] = useState('')
    const [csvMapping, setCsvMapping] = useState<CsvMapping>(EMPTY_CSV_MAPPING)
    const [geminiApiKey, setGeminiKeyState] = useState(
        () => readKey('gemini_api_key') || ''
    )
    const [claudeApiKey, setClaudeKeyState] = useState(
        () => readKey('claude_api_key') || ''
    )

    function setGeminiApiKey(value: string) {
        setGeminiKeyState(value)
        writeKey('gemini_api_key', value)
    }

    function setClaudeApiKey(value: string) {
        setClaudeKeyState(value)
        writeKey('claude_api_key', value)
    }

    const activeApiKey = selectedModel === 'claude-sonnet-4-6' ? claudeApiKey : geminiApiKey
    const canProcess = !!activeApiKey.trim()

    /**
     * onReplaced wipes the auto-suggested projects, and regenerating the same dates leaves
     * the suggestions themselves untouched, so bump a counter for useAutoProjects to key on.
     */
    function replaceRows(next: TimeSheetRow[] | null, onReplaced?: () => void) {
        setRows(next)
        setRowsVersion(v => v + 1)
        onReplaced?.()
    }

    function clearCsv() {
        setCsvTable(null)
        setCsvFileName('')
        setCsvMapping(EMPTY_CSV_MAPPING)
    }

    function setSourceMode(mode: SourceMode, onReplaced?: () => void) {
        if (mode === sourceMode) return
        setSourceModeState(mode)
        clearCsv()
        replaceRows(null, onReplaced)
    }

    /**
     * The rows are the same in both modes, so nothing index-keyed goes out of sync and
     * none of it may be reset: wiping the auto-suggested projects here left them empty,
     * since useAutoProjects only re-applies when the suggestions themselves change.
     */
    function setAppMode(mode: AppMode) {
        if (mode === appMode) return
        setAppModeState(mode)
    }

    function generateRowsForRange(start: IsoDate, end: IsoDate, onReplaced?: () => void) {
        if (daysInclusive(start, end) > MAX_RANGE_DAYS) {
            message.error(t.messages.periodTooLong(MAX_RANGE_DAYS))
            return
        }
        replaceRows(
            enumerateDays(start, end).map(date => ({ date, ...BLANK_TIMES })),
            onReplaced,
        )
    }

    async function loadCsvFile(file: File): Promise<void> {
        setLoading(true)
        try {
            const table = await parseCsvFile(file)
            setCsvTable(table)
            setCsvFileName(file.name)
            setCsvMapping(guessMapping(table.headers))
        } catch (error) {
            console.log(error)
            clearCsv()
            message.error(t.messages.csvParseError)
        } finally {
            setLoading(false)
        }
    }

    function setCsvMappingField(field: CsvField, header: string | null) {
        setCsvMapping(prev => ({ ...prev, [field]: header }))
    }

    function generateRowsFromCsv(onReplaced?: () => void) {
        if (!csvTable || !csvMapping.date) {
            message.error(t.messages.csvMissingDate)
            return
        }
        const next = normalizeOcrRows(mapCsvRows(csvTable, csvMapping))
        if (next.length === 0) {
            message.error(t.messages.csvNoRows)
            return
        }
        replaceRows(next, onReplaced)
    }

    function updateRowTime(index: number, field: TimeField, value: string) {
        setRows(prev => {
            if (!prev) return prev
            const next = [...prev]
            next[index] = { ...next[index], [field]: value }
            return next
        })
    }

    async function processFile(file: File, onBeforeProcess?: () => void): Promise<void> {
        if (!canProcess) {
            message.error(t.messages.missingApiKey)
            return
        }
        onBeforeProcess?.()
        setLoading(true)
        setRows(null)
        try {
            const imageInBase64 = await fileToBase64(file)
            const mimeType = (file.type || "image/png") as string
            const result = selectedModel === "claude-sonnet-4-6"
                ? await transcribeWithClaude(claudeApiKey.trim(), imageInBase64, mimeType)
                : await transcribeWithGemini(geminiApiKey.trim(), imageInBase64, mimeType)
            setRows(normalizeOcrRows(result))
        } catch (error) {
            console.log(error)
            message.error(t.messages.processError)
        } finally {
            setLoading(false)
        }
    }

    return {
        rows, rowsVersion, loading,
        appMode, setAppMode,
        sourceMode, setSourceMode,
        selectedModel, setSelectedModel,
        geminiApiKey, setGeminiApiKey,
        claudeApiKey, setClaudeApiKey,
        canProcess,
        processFile,
        generateRowsForRange,
        updateRowTime,
        csvTable, csvFileName, csvMapping,
        loadCsvFile, setCsvMappingField, clearCsv, generateRowsFromCsv,
    }
}

export type ReportVM = ReturnType<typeof useReport>
