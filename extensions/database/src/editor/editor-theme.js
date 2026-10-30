import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export function aturTheme() {
    return [
        EditorView.theme({
            "&": { backgroundColor: "var(--atur-background)", color: "var(--atur-foreground)", height: "100%" },
            ".cm-content": { caretColor: "var(--atur-accent)", fontFamily: "var(--font-mono)", fontSize: "var(--font-body)" },
            ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--atur-accent)" },
            ".cm-gutters": {
                backgroundColor: "var(--atur-background)",
                color: "var(--atur-foreground-muted)",
                border: "none",
                borderRight: "1px solid var(--atur-border)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--font-footnote)",
            },
            ".cm-activeLine": { backgroundColor: "var(--atur-hover)" },
            ".cm-activeLineGutter": { backgroundColor: "var(--atur-hover)" },
            "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
                backgroundColor: "var(--atur-accent-soft)",
            },
            ".cm-selectionMatch": { backgroundColor: "var(--atur-accent-soft)" },
            ".cm-tooltip": {
                backgroundColor: "var(--atur-surface)",
                border: "1px solid var(--atur-border)",
                color: "var(--atur-foreground)",
            },
            ".cm-tooltip-autocomplete ul li[aria-selected]": {
                backgroundColor: "var(--atur-accent-soft)",
                color: "var(--atur-foreground)",
            },
            ".cm-panels": { backgroundColor: "var(--atur-surface)", color: "var(--atur-foreground)" },
            ".cm-panels input, .cm-panels button": { fontSize: "var(--font-body)" },
        }),
        syntaxHighlighting(HighlightStyle.define([
            { tag: tags.keyword, color: "var(--atur-accent)", fontWeight: "600" },
            { tag: tags.string, color: "var(--atur-diff-add)" },
            { tag: [tags.number, tags.bool, tags.null], color: "var(--atur-diff-hunk)" },
            { tag: tags.comment, color: "var(--atur-foreground-muted)", fontStyle: "italic" },
            { tag: tags.operator, color: "var(--atur-foreground)" },
            { tag: [tags.typeName, tags.className], color: "var(--atur-diff-remove)" },
            { tag: tags.propertyName, color: "var(--atur-foreground)" },
        ])),
    ];
}
