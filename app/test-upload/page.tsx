import { TestUpload } from "@/components/test-upload"

export default function TestUploadPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Test PDF Upload to External API</h1>
      <TestUpload />
    </div>
  )
}
