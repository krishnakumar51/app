'use client';

import React from 'react';
import { Copy, QrCode, Video } from 'lucide-react';
import QRCode from 'qrcode.react';

import { useStore } from '@/lib/store';
import useWebRTC from '@/hooks/use-webrtc';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VideoPlayer from '@/components/video-player';
import MetricsPanel from '@/components/metrics-panel';
import { useToast } from '@/hooks/use-toast';

export default function LaptopView() {
  console.log('[LaptopView] Component rendered');
  const { offerSdp, setOfferSdp, answerSdp, setAnswerSdp, connectionState, remoteStream } = useStore();
  const { createOffer, setRemoteAnswer, startCamera } = useWebRTC('laptop');
  const { toast } = useToast();
  const [qrUrl, setQrUrl] = React.useState('');

  React.useEffect(() => {
    console.log('[LaptopView] useEffect: Initializing QR URL');
    const url = new URL(window.location.href);
    url.searchParams.set('role', 'phone');
    url.searchParams.delete('offer');
    setQrUrl(url.toString());
  }, []);

  const handleCreateOffer = async () => {
    console.log('[LaptopView] handleCreateOffer called');
    await startCamera();
    const offer = await createOffer();
    console.log('[LaptopView] Offer created:', offer);
    setOfferSdp(offer?.sdp ?? '');
    console.log('[LaptopView] offerSdp set to length:', offer?.sdp?.length);
  };

  const handleSetAnswer = async () => {
    console.log('[LaptopView] handleSetAnswer called');
    if (!answerSdp) {
      toast({
        title: "Error",
        description: "Please paste the Answer SDP from the phone.",
        variant: "destructive",
      });
      return;
    }
    await setRemoteAnswer(answerSdp);
  };
  
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
        title: 'Copied to clipboard',
        description: `${type} has been copied to your clipboard.`,
    });
  };

  const isConnected = connectionState === 'connected';

  if (isConnected && remoteStream) {
    console.log('[LaptopView] Connected and remote stream available, showing video player');
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full flex-col lg:flex-row">
        <div className="flex-1 p-4">
          <VideoPlayer />
        </div>
        <div className="w-full lg:w-[350px] lg:border-l">
          <MetricsPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Connect to Phone</CardTitle>
          <CardDescription>Follow these steps to connect to your phone's camera.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-semibold">Step 1: Create Offer</h3>
              <p className="text-sm text-muted-foreground">Generate an offer to send to the phone.</p>
              <Button onClick={handleCreateOffer} className="w-full">
                Create Offer
              </Button>
              <div className="relative">
                <Textarea
                  value={offerSdp}
                  readOnly
                  placeholder="Offer SDP will appear here..."
                  className="h-32 pr-10"
                />
                 {offerSdp && <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={() => copyToClipboard(offerSdp, 'Offer SDP')}><Copy className="h-4 w-4" /></Button>}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border bg-secondary/50 p-4">
              <h3 className="font-semibold">Scan QR on Phone</h3>
              <p className="text-center text-sm text-muted-foreground">
                On your phone, go to this page, select "Phone" role, and scan this QR code.
              </p>
              {qrUrl && offerSdp ? (
                <>
                  <QRCode value={`${qrUrl}&offer=${encodeURIComponent(offerSdp)}`} size={160} />
                  <p className="text-xs text-muted-foreground mt-2">Offer SDP length in QR: {offerSdp.length}</p>
                </>
              ) : (
                <div className="h-[160px] w-[160px] animate-pulse rounded-md bg-muted" />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Step 2: Set Answer</h3>
            <p className="text-sm text-muted-foreground">
              Once the phone generates an answer, paste it here to establish the connection.
            </p>
            <div className="relative">
              <Textarea
                value={answerSdp}
                onChange={(e) => setAnswerSdp(e.target.value)}
                placeholder="Paste Answer SDP from phone..."
                className="h-32 pr-10"
              />
              {answerSdp && <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={() => copyToClipboard(answerSdp, 'Answer SDP')}><Copy className="h-4 w-4" /></Button>}
            </div>
            <Button onClick={handleSetAnswer} className="w-full" disabled={!answerSdp}>
              Set Answer & Connect
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-4 rounded-lg border p-4">
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-medium">Status:</span>
              <span className="capitalize text-muted-foreground">{connectionState}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
