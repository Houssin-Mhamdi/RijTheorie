"use client"

import { useState } from "react"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import { supabase } from "@/lib/supabase"
import { Loader2, Plus, Trash2, Pencil, FileText, Eye, EyeOff, Star } from "lucide-react"
import type { BlogPost } from "@/types/database"
import BlogPostEditor from "@/components/blog/blog-post-editor"

const langLabels: Record<string, string> = {
  nl: "Nederlands", en: "English", ar: "العربية", fr: "Français",
  de: "Deutsch", tr: "Türkçe", pl: "Polski", es: "Español", it: "Italiano",
}

export default function AdminBlogPage() {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<BlogPost | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: posts, isLoading, refetch } = useSupabaseQuery<BlogPost[]>(
    ["blog_posts"],
    async () => supabase.from("blog_posts").select("*").order("created_at", { ascending: false }),
  )

  const handleTogglePublish = async (p: BlogPost) => {
    // Toggle published and set published_at on first publish
    const nextPublished = !p.published
    await supabase.from("blog_posts").update({
      published: nextPublished,
      published_at: nextPublished && !p.published_at ? new Date().toISOString() : p.published_at,
    }).eq("id", p.id)
    refetch()
  }

  const handleToggleFeatured = async (p: BlogPost) => {
    await supabase.from("blog_posts").update({ featured: !p.featured }).eq("id", p.id)
    refetch()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await supabase.from("blog_posts").delete().eq("id", deleteId)
    setDeleteId(null)
    refetch()
  }

  const titleFor = (p: BlogPost) => {
    for (const lang of ["nl", "en", "ar"]) {
      if (p.translations?.[lang]?.title) return p.translations[lang].title
    }
    return "Untitled"
  }

  const langsFilled = (p: BlogPost) => {
    const filled = Object.values(p.translations ?? {}).filter((t) => t?.title && t?.body).length
    const total = Object.keys(p.translations ?? {}).length
    return total > 0 ? `${filled}/${total}` : "0/0"
  }

  return (
    <div className="flex-grow space-y-6 px-4 md:px-6 py-8">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg text-primary">Blog</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Write SEO-optimized articles. Published posts appear on the public /blog page without login.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setEditorOpen(true) }}
          className="bg-primary text-white px-5 py-3 rounded-xl font-bold text-label-md hover:bg-primary-container transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <Plus size={18} /> New Post
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : (
        <section className="bg-white rounded-2xl border border-surface-container-highest shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Post</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4">Langs</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {posts && posts.length > 0 ? (
                  posts.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-bright transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          {p.cover_url ? (
                            <img src={p.cover_url} alt="" className="size-12 rounded-lg object-cover border border-outline-variant" />
                          ) : (
                            <div className="size-12 rounded-lg bg-surface-container-low flex items-center justify-center"><FileText size={20} className="text-on-surface-variant" /></div>
                          )}
                          <div>
                            <p className="font-bold text-body-md text-on-surface flex items-center gap-2">
                              {titleFor(p)}
                              {p.featured && <Star size={14} className="text-amber-500 fill-amber-500" />}
                            </p>
                            <p className="text-label-sm text-on-surface-variant">
                              {langsFilled(p)} languages filled
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-label-md font-mono text-on-surface-variant">/blog/{p.slug}</td>
                      <td className="px-6 py-5">
                        <div className="flex -space-x-1">
                          {Object.keys(p.translations ?? {}).map((l) => (
                            <span key={l} className="inline-flex items-center justify-center size-6 rounded-full bg-surface-container-low border-2 border-white text-label-xs font-bold uppercase text-on-surface-variant">
                              {l}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleTogglePublish(p)}
                            className={`inline-flex items-center gap-1.5 text-label-sm px-3 py-1 rounded-full font-bold w-fit transition-colors ${
                              p.published ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-on-surface-variant hover:bg-gray-200"
                            }`}
                          >
                            {p.published ? <Eye size={13} /> : <EyeOff size={13} />}
                            {p.published ? "Published" : "Draft"}
                          </button>
                          <button
                            onClick={() => handleToggleFeatured(p)}
                            className={`inline-flex items-center gap-1.5 text-label-sm px-3 py-1 rounded-full font-bold w-fit transition-colors ${
                              p.featured ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-gray-100 text-on-surface-variant hover:bg-gray-200"
                            }`}
                          >
                            <Star size={13} />
                            {p.featured ? "Featured" : "Normal"}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setEditing(p); setEditorOpen(true) }} className="p-2 rounded-lg hover:bg-surface-container transition-colors" title="Edit">
                            <Pencil size={16} className="text-on-surface-variant" />
                          </button>
                          <button onClick={() => setDeleteId(p.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 size={16} className="text-error" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center">
                      <FileText size={36} className="text-outline-variant mx-auto mb-3" />
                      <p className="text-body-md text-on-surface-variant">No blog posts yet. Click &quot;New Post&quot; to write your first article.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editorOpen && (
        <BlogPostEditor
          key={editing?.id ?? "new"}
          initialData={editing}
          onClose={() => setEditorOpen(false)}
          onSaved={() => { setEditorOpen(false); refetch() }}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-headline-md text-primary mb-2">Delete post?</h3>
            <p className="text-body-md text-on-surface-variant mb-6">This will permanently remove the blog post.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md font-bold text-on-surface-variant hover:bg-surface-container">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-5 py-2.5 rounded-xl bg-error text-white text-label-md font-bold hover:opacity-90">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
