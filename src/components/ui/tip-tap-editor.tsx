"use client"

import { useCallback, useEffect, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import LinkExtension from "@tiptap/extension-link"
import ImageExtension from "@tiptap/extension-image"
import { Bold, Italic, List, Link, Image, Unlink } from "lucide-react"

interface TipTapEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function TipTapEditor({ value, onChange, placeholder }: TipTapEditorProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: "p-4 min-h-[120px] focus:outline-none text-body-md text-on-surface [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_img]:rounded-lg [&_img]:max-w-full",
      },
    },
  })

  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor])
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor])
  const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor])
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

  if (!isMounted) {
    return (
      <div className="border border-outline-variant rounded-xl overflow-hidden bg-white">
        <div className="bg-surface-container px-3 py-2 flex gap-2 border-b border-outline-variant/30" />
        <div className="p-4 min-h-[120px] text-body-md text-on-surface-variant">{placeholder || ""}</div>
      </div>
    )
  }

  return (
    <div className="border border-outline-variant rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-primary">
      <div className="bg-surface-container px-3 py-2 flex gap-1 border-b border-outline-variant/30 flex-wrap">
        <button
          type="button"
          onClick={toggleBold}
          className={`p-1.5 rounded transition-colors ${editor?.isActive("bold") ? "bg-surface-variant text-primary" : "hover:bg-surface-variant text-on-surface-variant"}`}
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={toggleItalic}
          className={`p-1.5 rounded transition-colors ${editor?.isActive("italic") ? "bg-surface-variant text-primary" : "hover:bg-surface-variant text-on-surface-variant"}`}
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onClick={toggleBulletList}
          className={`p-1.5 rounded transition-colors ${editor?.isActive("bulletList") ? "bg-surface-variant text-primary" : "hover:bg-surface-variant text-on-surface-variant"}`}
        >
          <List size={18} />
        </button>
        <button
          type="button"
          onClick={setLink}
          className={`p-1.5 rounded transition-colors ${editor?.isActive("link") ? "bg-surface-variant text-primary" : "hover:bg-surface-variant text-on-surface-variant"}`}
        >
          <Link size={18} />
        </button>
        {editor?.isActive("link") && (
          <button
            type="button"
            onClick={() => editor?.chain().focus().unsetLink().run()}
            className="p-1.5 rounded hover:bg-surface-variant text-on-surface-variant transition-colors"
          >
            <Unlink size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={addImage}
          className="p-1.5 rounded hover:bg-surface-variant text-on-surface-variant transition-colors"
        >
          <Image size={18} />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
