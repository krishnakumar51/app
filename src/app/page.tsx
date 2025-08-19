import { Suspense } from 'react';
import VisionWeaver from '@/components/vision-weaver';
import { Toaster } from "@/components/ui/toaster"

export default function Home() {
  return (
    <>
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-background text-foreground">Loading Vision Weaver...</div>}>
        <VisionWeaver />
      </Suspense>
      <Toaster />
    </>
  );
}
