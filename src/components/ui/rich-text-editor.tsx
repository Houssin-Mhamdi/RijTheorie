"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import LinkExtension from "@tiptap/extension-link"
import ImageExtension from "@tiptap/extension-image"
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table"
import { Underline } from "@tiptap/extension-underline"
import { TextAlign } from "@tiptap/extension-text-align"
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote, Code, Heading1,
  Heading2, Heading3, Link, Image, Unlink, Table as TableIcon, AlignLeft, AlignCenter,
  AlignRight, Minus, Video, TableProperties,
} from "lucide-react"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({
  onClick, active, label, children,
}: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`p-1.5 rounded transition-colors ${
        active ? "bg-surface-variant text-primary" : "hover:bg-surface-variant text-on-surface-variant"
      }`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Underline,
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: "p-4 min-h-[220px] focus:outline-none text-body-md text-on-surface prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_img]:rounded-lg [&_img]:max-w-full [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-on-surface-variant [&_pre]:bg-surface-container [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_table]:border-collapse [&_table]:w-full [&_table]:my-4 [&_td]:border [&_td]:border-outline-variant [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-outline-variant [&_th]:px-3 [&_th]:py-2 [&_th]:bg-surface-container-low [&_th]:font-bold [&_h1]:text-headline-lg [&_h1]:font-bold [&_h1]:my-3 [&_h2]:text-headline-md [&_h2]:font-bold [&_h2]:my-3 [&_h3]:text-headline-sm [&_h3]:font-bold [&_h3]:my-2 [&_hr]:my-4 [&_hr]:border-outline-variant",
      },
    },
  })

  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor])
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor])
  const toggleUnderline = useCallback(() => editor?.chain().focus().toggleUnderline().run(), [editor])
  const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor])
  const toggleOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor])
  const toggleBlockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor])
  const toggleCodeBlock = useCallback(() => editor?.chain().focus().toggleCodeBlock().run(), [editor])
  const setHeading = useCallback((level: 1 | 2 | 3) => editor?.chain().focus().toggleHeading({ level }).run(), [editor])
  const setAlign = useCallback((align: "left" | "center" | "right") =>
    editor?.chain().focus().setTextAlign(align).run(), [editor])
  const setHr = useCallback(() => editor?.chain().focus().setHorizontalRule().run(), [editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes("link").href
    const url = window.prompt("Link URL", previousUrl || "https://")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }, [editor])

  const addImage = useCallback(() => {
    const url = window.prompt("Image URL", "https://")
    if (url) editor?.chain().focus().setImage({ src: url }).run()
  }, [editor])

  const addVideo = useCallback(() => {
    if (!editor) return
    const url = window.prompt("Video URL (YouTube / direct mp4)", "https://")
    if (!url) return
    editor.chain().focus().setParagraph().run()
    const embed = url.includes("youtube.com") || url.includes("youtu.be")
      ? youtubeEmbed(url)
      : url
    editor.chain().focus().insertContent({
      type: "paragraph",
      content: [
        { type: "text", text: embed, marks: [{ type: "link", attrs: { href: url } }] },
      ],
    }).run()
  }, [editor])

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])
  const addRowAfter = useCallback(() => editor?.chain().focus().addRowAfter().run(), [editor])
  const addColAfter = useCallback(() => editor?.chain().focus().addColumnAfter().run(), [editor])
  const deleteRow = useCallback(() => editor?.chain().focus().deleteRow().run(), [editor])
  const deleteCol = useCallback(() => editor?.chain().focus().deleteColumn().run(), [editor])
  const deleteTable = useCallback(() => editor?.chain().focus().deleteTable().run(), [editor])

  const isTableActive = useMemo(() => editor?.isActive("table") ?? false, [editor])

  if (!isMounted) {
    return (
      <div className="border border-outline-variant rounded-xl overflow-hidden bg-white">
        <div className="bg-surface-container px-3 py-2 flex gap-2 border-b border-outline-variant/30 flex-wrap" />
        <div className="p-4 min-h-[220px] text-body-md text-on-surface-variant">{placeholder || ""}</div>
      </div>
    )
  }

  return (
    <div className="border border-outline-variant rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-primary">
      <div className="bg-surface-container px-3 py-2 border-b border-outline-variant/30 flex flex-wrap gap-0.5 items-center">
        <ToolbarButton label="H1" active={editor?.isActive("heading", { level: 1 })} onClick={() => setHeading(1)}><Heading1 size={18} /></ToolbarButton>
        <ToolbarButton label="H2" active={editor?.isActive("heading", { level: 2 })} onClick={() => setHeading(2)}><Heading2 size={18} /></ToolbarButton>
        <ToolbarButton label="H3" active={editor?.isActive("heading", { level: 3 })} onClick={() => setHeading(3)}><Heading3 size={18} /></ToolbarButton>
        <span className="w-px h-5 bg-outline-variant/50 mx-1" />
        <ToolbarButton label="Bold" active={editor?.isActive("bold")} onClick={toggleBold}><Bold size={18} /></ToolbarButton>
        <ToolbarButton label="Italic" active={editor?.isActive("italic")} onClick={toggleItalic}><Italic size={18} /></ToolbarButton>
        <ToolbarButton label="Underline" active={editor?.isActive("underline")} onClick={toggleUnderline}><UnderlineIcon size={18} /></ToolbarButton>
        <ToolbarButton label="Bullet list" active={editor?.isActive("bulletList")} onClick={toggleBulletList}><List size={18} /></ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor?.isActive("orderedList")} onClick={toggleOrderedList}><ListOrdered size={18} /></ToolbarButton>
        <ToolbarButton label="Quote" active={editor?.isActive("blockquote")} onClick={toggleBlockquote}><Quote size={18} /></ToolbarButton>
        <ToolbarButton label="Code block" active={editor?.isActive("codeBlock")} onClick={toggleCodeBlock}><Code size={18} /></ToolbarButton>
        <span className="w-px h-5 bg-outline-variant/50 mx-1" />
        <ToolbarButton label="Left" active={editor?.isActive({ textAlign: "left" })} onClick={() => setAlign("left")}><AlignLeft size={18} /></ToolbarButton>
        <ToolbarButton label="Center" active={editor?.isActive({ textAlign: "center" })} onClick={() => setAlign("center")}><AlignCenter size={18} /></ToolbarButton>
        <ToolbarButton label="Right" active={editor?.isActive({ textAlign: "right" })} onClick={() => setAlign("right")}><AlignRight size={18} /></ToolbarButton>
        <span className="w-px h-5 bg-outline-variant/50 mx-1" />
        <ToolbarButton label="Link" active={editor?.isActive("link")} onClick={setLink}><Link size={18} /></ToolbarButton>
        {editor?.isActive("link") && (
          <ToolbarButton label="Remove link" onClick={() => editor?.chain().focus().unsetLink().run()}><Unlink size={18} /></ToolbarButton>
        )}
        <ToolbarButton label="Image" onClick={addImage}><Image size={18} /></ToolbarButton>
        <ToolbarButton label="Video" onClick={addVideo}><Video size={18} /></ToolbarButton>
        <span className="w-px h-5 bg-outline-variant/50 mx-1" />
        <ToolbarButton label="Table" active={isTableActive} onClick={insertTable}><TableProperties size={18} /></ToolbarButton>
        {isTableActive && (<>
          <ToolbarButton label="Add row" onClick={addRowAfter}><span className="text-label-sm font-bold">+R</span></ToolbarButton>
          <ToolbarButton label="Add column" onClick={addColAfter}><span className="text-label-sm font-bold">+C</span></ToolbarButton>
          <ToolbarButton label="Delete row" onClick={deleteRow}><span className="text-label-sm font-bold">-R</span></ToolbarButton>
          <ToolbarButton label="Delete column" onClick={deleteCol}><span className="text-label-sm font-bold">-C</span></ToolbarButton>
          <ToolbarButton label="Delete table" onClick={deleteTable}><TableIcon size={18} /></ToolbarButton>
        </>)}
        <span className="w-px h-5 bg-outline-variant/50 mx-1" />
        <ToolbarButton label="Horizontal rule" onClick={setHr}><Minus size={18} /></ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function youtubeEmbed(url: string): string {
  let id = ""
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/)
  if (m) id = m[1]
  if (!id) return url
  return `https://www.youtube.com/embed/${id}`
}
