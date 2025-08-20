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
  console.log('[useWebRTC] Initializing with role:', role);
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
    console.log('[useWebRTC] setupPeerConnection called');
    if (pcRef.current) {
      console.log('[useWebRTC] Peer connection already exists, returning existing instance');
      return pcRef.current;
    }
    
    console.log('[useWebRTC] Creating new RTCPeerConnection');
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc; // Assign to the mutable ref

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // In a real app, this would be sent to the other peer via signaling server
        console.log('[useWebRTC] New ICE candidate:', JSON.stringify(event.candidate));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pcRef.current) {
        console.log('[useWebRTC] Connection state changed to:', pcRef.current.connectionState);
        setConnectionState(pcRef.current.connectionState);
        toast({
          title: "Connection Status",
          description: `Status changed to: ${pcRef.current.connectionState}`,
        })
      }
    };

    pc.ontrack = (event) => {
      console.log('[useWebRTC] ontrack event received, setting remote stream');
      setRemoteStream(event.streams[0]);
    };

    return pc;
  }, [setConnectionState, setRemoteStream, toast]);

  const startCamera = React.useCallback(async () => {
    console.log('[useWebRTC] startCamera called');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      console.log('[useWebRTC] Camera stream obtained', stream);
      setLocalStream(stream);

      const pc = setupPeerConnection();
      stream.getTracks().forEach((track) => {
        if (pc.getSenders().find(s => s.track === track)) {
          return;
        }
        console.log('[useWebRTC] Adding track to peer connection:', track);
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
    console.log('[useWebRTC] createOffer called');
    const pc = setupPeerConnection();
    console.log('[useWebRTC] Creating SDP offer...');
    const offer = await pc.createOffer();
    console.log('[useWebRTC] Setting local description (offer)');
    await pc.setLocalDescription(offer);
    console.log('[useWebRTC] Waiting for ICE gathering to complete...');
    
    // Add timeout for ICE gathering
    const iceGatheringPromise = new Promise<void>((resolve, reject) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const handler = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', handler);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', handler);
        
        // Add timeout after 10 seconds
        setTimeout(() => {
          pc.removeEventListener('icegatheringstatechange', handler);
          console.warn('[useWebRTC] ICE gathering timeout, proceeding with current state');
          resolve();
        }, 10000);
      }
    });
    
    await iceGatheringPromise;
    console.log('[useWebRTC] Offer created and set as local description', offer);
    return offer;
  }, [setupPeerConnection]);

  const setRemoteOffer = React.useCallback(async (sdp: string) => {
    try {
  const pc = setupPeerConnection();
  console.log('[useWebRTC] setRemoteOffer: incoming offer length=', sdp?.length);
  await pc.setRemoteDescription({ type: 'offer', sdp });
  console.log('[useWebRTC] setRemoteOffer: pc.remoteDescription.type=', pc.remoteDescription?.type, 'pc.remoteDescription.sdpLength=', pc.remoteDescription?.sdp?.length);
    } catch(e) {
      console.error("Failed to set remote offer", e);
      toast({ title: "Error setting offer", variant: "destructive" });
    }
  }, [setupPeerConnection, toast]);

  const createAnswer = React.useCallback(async () => {
    console.log('[useWebRTC] createAnswer called');
    const pc = setupPeerConnection();
    // Ensure the remote offer is set before creating an answer
    if (!pc.remoteDescription || pc.remoteDescription.type !== 'offer') {
        console.warn('[useWebRTC] Remote offer not set or not of type offer');
        toast({ title: "Remote offer not set", description: "Cannot create an answer without an offer.", variant: "destructive"});
        return;
    }
  console.log('[useWebRTC] createAnswer: remoteDescription.sdp length=', pc.remoteDescription?.sdp?.length);
  console.log('[useWebRTC] Creating SDP answer...');
  const answer = await pc.createAnswer();
  console.log('[useWebRTC] Setting local description (answer)');
  await pc.setLocalDescription(answer);
  console.log('[useWebRTC] Waiting for ICE gathering to complete...');
  
  // Add timeout for ICE gathering
  const iceGatheringPromise = new Promise<void>((resolve, reject) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
    } else {
      const handler = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', handler);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', handler);
      
      // Add timeout after 10 seconds
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', handler);
        console.warn('[useWebRTC] ICE gathering timeout, proceeding with current state');
        resolve();
      }, 10000);
    }
  });
  
  await iceGatheringPromise;
  console.log('[useWebRTC] Answer created and set as local description', answer);
  console.log('[useWebRTC] createAnswer: generated answer.sdp length=', answer?.sdp?.length);
  return answer;
  }, [setupPeerConnection, toast]);

  const setRemoteAnswer = React.useCallback(async (sdp: string) => {
    console.log('[useWebRTC] setRemoteAnswer called with sdp length:', sdp?.length);
    if (!pcRef.current) {
        console.warn('[useWebRTC] Peer connection not initialized when trying to set remote answer');
        toast({ title: "Connection not initialized", variant: "destructive" });
        return;
    }
    try {
        console.log('[useWebRTC] Setting remote description (answer)');
        await pcRef.current.setRemoteDescription({ type: 'answer', sdp });
        console.log('[useWebRTC] Remote answer set successfully');
    } catch(e) {
        console.error("Failed to set remote answer", e);
        toast({ title: "Error setting answer", variant: "destructive" });
    }
  }, [toast]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (pcRef.current) {
        console.log('[useWebRTC] Cleaning up peer connection on unmount');
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  return { startCamera, createOffer, setRemoteOffer, createAnswer, setRemoteAnswer };
};

export default useWebRTC;
