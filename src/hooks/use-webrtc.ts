'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import type { Role } from '@/lib/types';
import { useToast } from './use-toast';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Store the peer connection instance in a ref outside the component to ensure it persists across renders.
const pcRef = React.createRef<RTCPeerConnection>();

const useWebRTC = (role: Role) => {
  const { 
    setPeerConnection, setLocalStream, setRemoteStream, 
    setConnectionState, peerConnection 
  } = useStore();
  const { toast } = useToast();

  // This function will be responsible for creating and setting up the peer connection.
  const setupPeerConnection = React.useCallback(() => {
    if (pcRef.current) {
      return pcRef.current;
    }
    
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // In a real app, this would be sent to the other peer via signaling server
        console.log('New ICE candidate:', JSON.stringify(event.candidate));
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      toast({
        title: "Connection Status",
        description: `Status changed to: ${pc.connectionState}`,
      })
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pcRef.current = pc;
    setPeerConnection(pc);
    return pc;
  }, [setConnectionState, setPeerConnection, setRemoteStream, toast]);

  const startCamera = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      setLocalStream(stream);

      const pc = setupPeerConnection();
      stream.getTracks().forEach((track) => {
        if (pc.getSenders().find(s => s.track === track)) {
          return;
        }
        pc.addTrack(track, stream)
      });

    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      })
    }
  }, [setLocalStream, setupPeerConnection, toast]);

  const createOffer = React.useCallback(async () => {
    const pc = setupPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }, [setupPeerConnection]);

  const setRemoteOffer = React.useCallback(async (sdp: string) => {
    try {
      const pc = setupPeerConnection();
      await pc.setRemoteDescription({ type: 'offer', sdp });
    } catch(e) {
      console.error("Failed to set remote offer", e);
      toast({ title: "Error setting offer", variant: "destructive" });
    }
  }, [setupPeerConnection, toast]);

  const createAnswer = React.useCallback(async () => {
    const pc = setupPeerConnection();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }, [setupPeerConnection]);

  const setRemoteAnswer = React.useCallback(async (sdp: string) => {
    if (!pcRef.current) {
        toast({ title: "Connection not initialized", variant: "destructive" });
        return;
    }
    try {
        await pcRef.current.setRemoteDescription({ type: 'answer', sdp });
    } catch(e) {
        console.error("Failed to set remote answer", e);
        toast({ title: "Error setting answer", variant: "destructive" });
    }
  }, [toast]);

  return { startCamera, createOffer, setRemoteOffer, createAnswer, setRemoteAnswer };
};

export default useWebRTC;
