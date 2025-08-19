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

const useWebRTC = (role: Role) => {
  const { 
    setLocalStream, setRemoteStream, 
    setConnectionState
  } = useStore();
  const { toast } = useToast();
  // Use useRef to hold the mutable peer connection object.
  // This instance will persist across re-renders.
  const pcRef = React.useRef<RTCPeerConnection | null>(null);

  // This function will be responsible for creating and setting up the peer connection.
  // It ensures only one instance is created.
  const setupPeerConnection = React.useCallback(() => {
    if (pcRef.current) {
      return pcRef.current;
    }
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc; // Assign to the mutable ref

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // In a real app, this would be sent to the other peer via signaling server
        console.log('New ICE candidate:', JSON.stringify(event.candidate));
      }
    };
    console.log("s")

    pc.onconnectionstatechange = () => {
      if (pcRef.current) {
        setConnectionState(pcRef.current.connectionState);
        toast({
          title: "Connection Status",
          description: `Status changed to: ${pcRef.current.connectionState}`,
        })
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    return pc;
  }, [setConnectionState, setRemoteStream, toast]);

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
    // Ensure the remote offer is set before creating an answer
    if (!pc.remoteDescription || pc.remoteDescription.type !== 'offer') {
        toast({ title: "Remote offer not set", description: "Cannot create an answer without an offer.", variant: "destructive"});
        return;
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }, [setupPeerConnection, toast]);

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

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  return { startCamera, createOffer, setRemoteOffer, createAnswer, setRemoteAnswer };
};

export default useWebRTC;
