'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Camera, Copy } from 'lucide-react';

import { useStore } from '@/lib/store';
import useWebRTC from '@/hooks/use-webrtc';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function PhoneView() {
  const { localStream, offerSdp, setOfferSdp, answerSdp, setAnswerSdp, connectionState } = useStore();
  const { startCamera, createAnswer, setRemoteOffer } = useWebRTC('phone');
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  React.useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  React.useEffect(() => {
    const offerFromUrl = searchParams.get('offer');
    if (offerFromUrl) {
      const decodedOffer = decodeURIComponent(offerFromUrl);
      setOfferSdp(decodedOffer);
      toast({
        title: "Offer Received",
        description: "Offer SDP has been populated from the URL.",
      })
    }
  }, [searchParams, setOfferSdp, toast]);

  const handleCreateAnswer = async () => {
    if (!offerSdp) {
      toast({
        title: "Error",
        description: "Please paste the Offer SDP from the laptop first.",
        variant: "destructive",
      });
      return;
    }
  console.log('[PhoneView] handleCreateAnswer: offerSdp length=', offerSdp?.length);
  await setRemoteOffer(offerSdp);
  console.log('[PhoneView] handleCreateAnswer: called setRemoteOffer');
  const answer = await createAnswer();
  console.log('[PhoneView] handleCreateAnswer: createAnswer returned', !!answer);
  if (answer?.sdp) {
    console.log('[PhoneView] handleCreateAnswer: setting answer.sdp length=', answer.sdp.length);
    setAnswerSdp(answer.sdp);
  } else {
    console.warn('[PhoneView] handleCreateAnswer: no answer generated');
  }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
        title: 'Copied to clipboard',
        description: `${type} has been copied to your clipboard.`,
    });
  };

  if (!localStream) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Start Your Camera</CardTitle>
            <CardDescription>Click the button below to start streaming your camera.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={startCamera} className="w-full">
              <Camera className="mr-2 h-4 w-4" />
              Start Camera
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Connecting to Laptop</CardTitle>
          <CardDescription>You are the sender. Follow the steps to connect.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-2 left-2 flex items-center space-x-2 rounded-full bg-black/50 px-3 py-1 text-white">
              <div className={`h-3 w-3 rounded-full ${connectionState === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium capitalize">{connectionState}</span>
            </div>
          </div>
          
          <div className="space-y-4">
              <h3 className="font-semibold">Step 1: Get Offer from Laptop</h3>
              <p className="text-sm text-muted-foreground">
                Scan the QR code on the laptop screen or paste the Offer SDP below.
              </p>
              <div className="relative">
                <Textarea
                  value={offerSdp}
                  onChange={(e) => setOfferSdp(e.target.value)}
                  placeholder="Paste Offer SDP from laptop..."
                  className="h-32 pr-10"
                />
                 {offerSdp && <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={() => copyToClipboard(offerSdp, 'Offer SDP')}><Copy className="h-4 w-4" /></Button>}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Step 2: Create and Share Answer</h3>
              <p className="text-sm text-muted-foreground">
                Generate an answer and copy-paste it to the laptop.
              </p>
              <Button onClick={handleCreateAnswer} className="w-full" disabled={!offerSdp}>
                Create Answer
              </Button>
              <div className="relative">
                <Textarea
                  value={answerSdp}
                  readOnly
                  placeholder="Answer SDP will appear here..."
                  className="h-32 pr-10"
                />
                {answerSdp && <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={() => copyToClipboard(answerSdp, 'Answer SDP')}><Copy className="h-4 w-4" /></Button>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
