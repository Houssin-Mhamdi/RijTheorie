"use client"

import { useRef, useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { questionSchema, type QuestionInput } from "@/lib/auth-schemas"
import { type Resolver } from "react-hook-form"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Upload, Plus, Trash2, ChevronDown, X, FileVideo, FileImage, Loader2, Languages } from "lucide-react"
import { cn } from "@/lib/utils"
import TipTapEditor from "@/components/ui/tip-tap-editor"
import ImageHotspot from "@/components/questions/image-hotspot"
import VideoHotspot from "@/components/questions/video-hotspot"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface QuestionFormProps {
  onSubmit: (data: QuestionInput) => void
  isPending?: boolean
  initialData?: QuestionInput | null
  userId?: string
  onUploadingChange?: (uploading: boolean) => void
}

export default function QuestionForm({ onSubmit, isPending, initialData, userId, onUploadingChange }: QuestionFormProps) {
  const form = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema) as Resolver<QuestionInput>,
    defaultValues: {
      category: "",
      questionText: "",
      media: "",
      answerOptions: [
        { text: "1st - Red car", isCorrect: true },
        { text: "2nd - Bus", isCorrect: true },
        { text: "3rd - Tram", isCorrect: true },
        { text: "4th - Bicycle", isCorrect: true },
      ],
      explanation: "",
      translations: [],
      pauseAt: 3,
    },
  })

  const { fields, append, remove, update } = useFieldArray({ control: form.control, name: "answerOptions" })
  const { fields: translationFields, append: appendTranslation, replace: replaceTranslation } = useFieldArray({ control: form.control, name: "translations" })

  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaMime, setMediaMime] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [storedMediaUrl, setStoredMediaUrl] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onUploadingChange?.(isUploading)
  }, [isUploading, onUploadingChange])

  const category = form.watch("category")
  const hasMedia = !!mediaPreview
  const isImageHotspot = category === "Right of Way" && hasMedia && mediaMime.startsWith("image/")
  const isVideoHotspot = category === "Right of Way" && hasMedia && mediaMime.startsWith("video/")
  const isInteractive = isImageHotspot || isVideoHotspot
  const isChooseImages = category === "Choose Images"

  useEffect(() => {
    if (initialData) {
      form.reset(initialData)
      if (initialData.translations?.length) {
        replaceTranslation(initialData.translations)
      }
      if (initialData.media) {
        setMediaPreview(initialData.media)
        setStoredMediaUrl(initialData.media)
        setMediaMime(initialData.media.match(/\.(mp4|webm|ogg|mov)$/i) ? "video/" : "image/")
      }
    } else {
      form.reset()
      setMediaPreview(null)
      setMediaMime("")
      setStoredMediaUrl("")
    }
  }, [initialData])



  async function uploadFile(file: File): Promise<string | null> {
    if (!userId) {
      toast.error("You must be logged in to upload files")
      return null
    }
    const ext = file.name.split(".").pop() || (file.type.startsWith("video/") ? "mp4" : "jpg")
    const filePath = `${userId}/${crypto.randomUUID()}.${ext}`
    setIsUploading(true)
    try {
      const { error } = await supabase.storage.from("question-media").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })
      if (error) throw error
      const { data: urlData } = supabase.storage.from("question-media").getPublicUrl(filePath)
      return urlData.publicUrl
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to upload file")
      return null
    } finally {
      setIsUploading(false)
    }
  }

  async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setMediaPreview(previewUrl)
    setMediaMime(file.type)
    const publicUrl = await uploadFile(file)
    if (publicUrl) {
      setStoredMediaUrl(publicUrl)
      form.setValue("media", publicUrl)
    } else if (storedMediaUrl) {
      form.setValue("media", storedMediaUrl)
    } else {
      form.setValue("media", previewUrl)
    }
  }

  async function clearMedia() {
    if (storedMediaUrl) {
      const path = storedMediaUrl.split("/question-media/")[1]
      if (path) {
        await supabase.storage.from("question-media").remove([path])
      }
    }
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setMediaPreview(null)
    setMediaMime("")
    setStoredMediaUrl("")
    form.setValue("media", "")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      const publicUrl = await uploadFile(file)
      if (publicUrl) {
        append({ text: file.name.replace(/\.[^/.]+$/, ""), isCorrect: false, imageUrl: publicUrl })
      }
    }
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  function handleHotspotChange(index: number, x: number, y: number) {
    update(index, { ...fields[index], x, y })
  }

  const [showTextOptions, setShowTextOptions] = useState(false)
  const isHotspot = isInteractive && !showTextOptions

  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(["nl"])
  const formReady = useRef(false)

  const langLabels: Record<string, string> = {
    nl: "Nederlands", en: "English", ar: "العربية", fr: "Français",
    de: "Deutsch", tr: "Türkçe", pl: "Polski", es: "Español", it: "Italiano",
  }

  useEffect(() => {
    supabase.from("site_settings").select("languages").eq("id", 1).single().then(({ data, error }) => {
      if (error && error.code === "PGRST205") return
      if (data) setSupportedLanguages(data.languages as string[] || ["nl"])
    })
  }, [])

  useEffect(() => {
    formReady.current = true
  }, [initialData])

  useEffect(() => {
    if (!formReady.current || !supportedLanguages.length) return
    const existingLangs = translationFields.map((t) => t.lang)
    supportedLanguages.forEach((code) => {
      if (code === "nl") return
      if (!existingLangs.includes(code)) {
        appendTranslation({
          lang: code,
          questionText: "",
          answerOptions: fields.map(() => ({ text: "" })),
          explanation: "",
          active: true,
        })
      }
    })
  }, [supportedLanguages, initialData])

  useEffect(() => {
    if (isHotspot || category === "Right of Way") {
      fields.forEach((f, i) => {
        if (!f.isCorrect) update(i, { ...f, isCorrect: true })
      })
    }
  }, [isHotspot, category])

  return (
    <Form {...form}>
      <form id="question-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem>
            <FormLabel>Category</FormLabel>
            <FormControl>
              <div className="relative">
                <select
                  {...field}
                  onChange={(e) => { field.onChange(e); setShowTextOptions(false) }}
                  className={cn(
                    "w-full h-12 bg-white border rounded-xl px-4 appearance-none focus:ring-2 focus:ring-primary focus:border-primary text-body-md",
                    field.value ? "text-on-surface" : "text-on-surface-variant",
                  )}
                >
                   <option value="" disabled>Select a category</option>
                  <option value="Hazard Perception">Hazard Perception</option>
                  <option value="Priority">Priority</option>
                  <option value="Traffic">Traffic</option>
                  <option value="Lighting">Lighting</option>
                  <option value="Right of Way">Right of Way</option>
                  <option value="Choose Images">Choose Images</option>
                  <option value="Driving">Driving</option>
                  <option value="Parking">Parking</option>
                </select>
                <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="questionText" render={({ field }) => (
          <FormItem>
            <FormLabel>Question Text</FormLabel>
            <FormControl>
              <textarea
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder="Type the question as the student will see it..."
                rows={4}
                className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary text-body-md resize-y min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {!isChooseImages && (
        <FormField control={form.control} name="media" render={() => (
          <FormItem>
            <FormLabel>Media <span className="text-on-surface-variant font-normal">(optional)</span></FormLabel>
            <FormControl>
              <div>
                {mediaPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-outline-variant bg-surface-container-low">
                    {mediaMime.startsWith("video/") ? (
                      <video src={mediaPreview} controls preload="auto" className="w-full max-h-[300px] object-contain" />
                    ) : (
                      <img src={mediaPreview} alt="Preview" className="w-full max-h-[300px] object-contain" />
                    )}
                    <button
                      type="button"
                      onClick={clearMedia}
                      disabled={isUploading}
                      className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors disabled:opacity-50"
                    >
                      <X size={18} />
                    </button>
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="bg-white rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
                          <Loader2 size={18} className="animate-spin text-primary" />
                          <span className="text-label-md text-primary font-medium">Uploading…</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center bg-surface-container-low transition-colors group ${isUploading ? "opacity-50 pointer-events-none" : "border-outline-variant hover:bg-surface-container-high cursor-pointer"}`}
                  >
                    <div className="size-12 rounded-full bg-primary-container/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload size={24} className="text-primary" />
                    </div>
                    <p className="text-body-md font-medium text-primary">Click to upload or drag a file</p>
                    <p className="text-label-sm text-outline flex items-center gap-1 mt-1">
                      <FileImage size={14} /> Image
                      <span className="mx-1">or</span>
                      <FileVideo size={14} /> Video
                      <span className="mx-1">-</span> max. 10MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleMediaSelect}
                  disabled={isUploading}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        )}

        {!isChooseImages && (
        <>
        {isHotspot ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <FormLabel className="text-body-md">
                {isVideoHotspot ? "Play the video, then drag circles onto the scene" : "Drag circles onto the image"}
              </FormLabel>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTextOptions(true)}
                  className="text-label-sm text-primary hover:underline"
                >
                  Switch to text mode
                </button>
                <button
                  type="button"
                  onClick={() => append({ text: "", isCorrect: true })}
                  className="text-label-sm text-secondary font-bold flex items-center gap-1 hover:underline"
                >
                  <Plus size={14} />
                  Add circle
                </button>
              </div>
            </div>
            {isVideoHotspot ? (
              <VideoHotspot
                videoUrl={mediaPreview!}
                options={fields}
                pauseAt={form.watch("pauseAt") ?? 3}
                onPauseChange={(val) => form.setValue("pauseAt", val, { shouldDirty: true })}
                onChange={handleHotspotChange}
                onTextChange={(index, text) => update(index, { ...fields[index], text })}
                onDelete={(index) => remove(index)}
              />
            ) : (
              <ImageHotspot
                imageUrl={mediaPreview!}
                options={fields}
                onChange={handleHotspotChange}
                onTextChange={(index, text) => update(index, { ...fields[index], text })}
                onDelete={(index) => remove(index)}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <FormLabel className="text-body-md">Answer Options</FormLabel>
              <div className="flex items-center gap-2">
                {isInteractive && (
                  <button
                    type="button"
                    onClick={() => setShowTextOptions(false)}
                    className="text-label-sm text-primary hover:underline"
                  >
                    Switch to hotspot mode
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => append({ text: "", isCorrect: category === "Right of Way" })}
                  className="text-secondary font-label-md text-label-md flex items-center gap-1 hover:underline"
                >
                  <Plus size={18} />
                  Add option
                </button>
              </div>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-center group">
                <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0 mt-3">
                  {index + 1}
                </div>
                <input
                  type="text"
                  defaultValue={field.text}
                  onChange={(e) => form.setValue(`answerOptions.${index}.text`, e.target.value, { shouldDirty: true })}
                  placeholder="New answer option..."
                  className="flex-1 h-12 bg-white border border-outline-variant rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-primary text-body-md"
                />
                {category !== "Right of Way" && (
                  <div className="flex flex-col items-center">
                    <input
                      type="checkbox"
                      checked={field.isCorrect}
                      onChange={() => update(index, { ...fields[index], isCorrect: !fields[index].isCorrect })}
                      className="size-6 rounded border-outline-variant text-secondary-container focus:ring-secondary-container"
                    />
                    <span
                      className={cn(
                        "text-[10px] font-bold mt-1",
                        field.isCorrect ? "text-secondary-container" : "text-outline",
                      )}
                    >
                      {field.isCorrect ? "CORRECT" : "WRONG"}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-2 text-outline opacity-0 group-hover:opacity-100 transition-opacity hover:text-error"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            {form.formState.errors.answerOptions && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.answerOptions.message || form.formState.errors.answerOptions.root?.message}
              </p>
            )}
          </div>
        )}
        </>
        )}

        {isChooseImages && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <FormLabel className="text-body-md">Answer Images</FormLabel>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="text-secondary font-label-md text-label-md flex items-center gap-1 hover:underline"
              >
                <Upload size={18} />
                Add images
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {fields.length === 0 && (
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="border-2 border-dashed border-outline-variant rounded-xl p-8 flex flex-col items-center justify-center min-h-[160px] hover:bg-surface-container-low cursor-pointer col-span-full"
                >
                  <Upload size={24} className="text-primary" />
                  <span className="text-label-sm text-primary mt-2">Upload answer images</span>
                </div>
              )}
              {fields.map((field, index) => (
                <div key={field.id} className="relative rounded-xl overflow-hidden border-2 transition-colors"
                  style={{ borderColor: field.isCorrect ? "#16a34a" : "#e0e0e0" }}
                >
                  {field.imageUrl ? (
                    <img src={field.imageUrl} alt={`Option ${index + 1}`} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-surface-container-low text-outline text-label-sm">
                      No image
                    </div>
                  )}
                  <div className="p-2 flex items-center justify-between bg-surface-container-low">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.isCorrect}
                        onChange={() => update(index, { ...fields[index], isCorrect: !fields[index].isCorrect })}
                        className="size-5 rounded border-outline-variant text-secondary-container focus:ring-secondary-container"
                      />
                      <span className={cn("text-[10px] font-bold", field.isCorrect ? "text-secondary-container" : "text-outline")}>
                        {field.isCorrect ? "CORRECT" : "WRONG"}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-1 text-outline hover:text-error transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {fields.length > 0 && (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center min-h-[160px] hover:bg-surface-container-low cursor-pointer"
                >
                  <Upload size={24} className="text-primary" />
                  <span className="text-label-sm text-primary mt-2">Add image</span>
                </button>
              )}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>
        )}

        <FormField control={form.control} name="explanation" render={({ field }) => (
          <FormItem>
            <FormLabel>Explanation (Feedback) <span className="text-on-surface-variant font-normal">(optional)</span></FormLabel>
            <FormControl>
              <TipTapEditor value={field.value || ""} onChange={field.onChange} placeholder="Explain why the correct answer is right..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="border-t border-outline-variant pt-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Languages size={20} className="text-primary" />
            <span className="text-body-md font-medium">Translations</span>
            <span className="text-label-sm text-outline">(vul in voor elke ondersteunde taal)</span>
          </div>
          {translationFields.length === 0 ? (
            <p className="text-label-sm text-outline">Geen extra talen ingesteld in de instellingen.</p>
          ) : (
            <div className="space-y-4">
              {translationFields.map((tf, tIndex) => (
                <div key={tf.id} className="border border-outline-variant rounded-xl p-4 bg-surface-container-low">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-label-sm font-bold text-primary uppercase">{langLabels[tf.lang] || tf.lang.toUpperCase()}</span>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          defaultChecked={!!form.watch(`translations.${tIndex}.active`)}
                          onChange={(e) => form.setValue(`translations.${tIndex}.active`, e.target.checked, { shouldDirty: true })}
                          className="size-4 rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span className="text-[11px] text-on-surface-variant">Toon in examen</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-label-sm text-on-surface-variant mb-1 block">Question Text</label>
                      <textarea
                        {...form.register(`translations.${tIndex}.questionText`)}
                        rows={3}
                        className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary text-body-md resize-y min-h-[80px]"
                        placeholder={`Translated question text (${tf.lang.toUpperCase()})`}
                      />
                    </div>
                    {fields.length > 0 && (
                      <div>
                        <label className="text-label-sm text-on-surface-variant mb-1 block">Answer Options</label>
                        <div className="space-y-2">
                          {fields.map((_, aIndex) => {
                            const fieldPath = `translations.${tIndex}.answerOptions.${aIndex}.text` as const
                            return (
                              <div key={aIndex} className="flex items-center gap-2">
                                <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                  {aIndex + 1}
                                </div>
                                <input
                                  value={form.watch(fieldPath) ?? ""}
                                  onChange={(e) => form.setValue(fieldPath, e.target.value, { shouldDirty: true })}
                                  placeholder={`Option ${aIndex + 1}`}
                                  className="flex-1 h-10 bg-white border border-outline-variant rounded-lg px-3 focus:ring-2 focus:ring-primary focus:border-primary text-body-md"
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-label-sm text-on-surface-variant mb-1 block">Explanation</label>
                      <textarea
                        {...form.register(`translations.${tIndex}.explanation`)}
                        rows={2}
                        className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary text-body-md resize-y"
                        placeholder={`Translated explanation (${tf.lang.toUpperCase()})`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="hidden" />
      </form>
    </Form>
  )
}
