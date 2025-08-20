'use client';

import React from 'react';
import { useStore } from '@/lib/store';
import type { Role } from '@/lib/types';
import { useToast } from './use-toast';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    // Prefer TURN if provided via env (NEXT_PUBLIC_* so it is available client-side)
    ...(process.env.NEXT_PUBLIC_TURN_URL
      ? [
          {
            urls: process.env.NEXT_PUBLIC_TURN_URL.split(',').map((u) => u.trim()),
            username: process.env.NEXT_PUBLIC_TURN_USERNAME,
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
          } as RTCIceServer,
        ]
      : [
          // Fallback to a public relay for demos. For production, provide your own TURN.
          { urls: ['stun:stun.openrelay.metered.ca:80'] },
          {
            urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443?transport=tcp'],
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ]),
  ],
  iceTransportPolicy: process.env.NEXT_PUBLIC_FORCE_TURN === 'true' ? 'relay' : 'all',
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
    const hasCustomTurn = Boolean(process.env.NEXT_PUBLIC_TURN_URL);
    const forceRelay = process.env.NEXT_PUBLIC_FORCE_TURN === 'true';
    console.log('[useWebRTC] ICE config -> hasCustomTurn:', hasCustomTurn, 'forceRelay:', forceRelay);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc; // Assign to the mutable ref

    const seenCandidateTypes = { host: false, srflx: false, relay: false };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // In a real app, this would be sent to the other peer via signaling server
        console.log('[useWebRTC] New ICE candidate:', JSON.stringify(event.candidate));

        // Candidate type diagnostics
        const cand = event.candidate.candidate || '';
        if (cand.includes(' typ relay')) {
          if (!seenCandidateTypes.relay) {
            console.log('[useWebRTC] First RELAY candidate discovered (TURN reachable)');
          }
          seenCandidateTypes.relay = true;
        } else if (cand.includes(' typ srflx')) {
          if (!seenCandidateTypes.srflx) console.log('[useWebRTC] First SRFLX candidate discovered (STUN reflexive)');
          seenCandidateTypes.srflx = true;
        } else if (cand.includes(' typ host')) {
          if (!seenCandidateTypes.host) console.log('[useWebRTC] First HOST candidate discovered (local network)');
          seenCandidateTypes.host = true;
        }
      }
    };

    pc.onicecandidateerror = (event: RTCPeerConnectionIceErrorEvent) => {
      console.error('[useWebRTC] ICE candidate error:', {
        address: event.address,
        port: event.port,
        url: (event as any).url,
        errorCode: event.errorCode,
        errorText: event.errorText,
      });
    };

    pc.onicegatheringstatechange = () => {
      console.log('[useWebRTC] ICE gathering state changed to:', pc.iceGatheringState);
    };

    pc.onconnectionstatechange = () => {
      if (pcRef.current) {
        console.log('[useWebRTC] Connection state changed to:', pcRef.current.connectionState);
        console.log('[useWebRTC] ICE connection state:', pcRef.current.iceConnectionState);
        console.log('[useWebRTC] ICE gathering state:', pcRef.current.iceGatheringState);
        setConnectionState(pcRef.current.connectionState);
        toast({
          title: "Connection Status",
          description: `Status changed to: ${pcRef.current.connectionState}`,
        })
      }
    };

    pc.onsignalingstatechange = () => {
      if (pcRef.current) {
        console.log('[useWebRTC] Signaling state changed to:', pcRef.current.signalingState);
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
      // For the 'phone' role (answerer), avoid adding tracks immediately to prevent m-line reordering.
      if (role !== 'phone') {
        stream.getTracks().forEach((track) => {
          if (pc.getSenders().find(s => s.track === track)) return;
          console.log('[useWebRTC] Adding track to peer connection:', track.kind);
          pc.addTrack(track, stream);
        });
      } else {
        // If remote offer is already present, attach tracks in a way that preserves m-line order.
        if (pc.remoteDescription && pc.remoteDescription.type === 'offer') {
          const transceivers = pc.getTransceivers();
          stream.getTracks().forEach((track) => {
            let attached = false;
            for (const tr of transceivers) {
              try {
                // Prefer reusing transceivers of same kind
                if (tr.receiver && tr.receiver.track && tr.receiver.track.kind === track.kind && tr.sender && !tr.sender.track) {
                  tr.sender.replaceTrack(track as MediaStreamTrack);
                  tr.direction = 'sendrecv';
                  attached = true;
                  break;
                }
              } catch (e) {
                // ignore and continue
              }
            }
            if (!attached) {
              pc.addTrack(track, stream);
            }
          });
        }
      }

    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      })
    }
  }, [setLocalStream, setupPeerConnection, toast, role]);

  const createOffer = React.useCallback(async () => {
    console.log('[useWebRTC] createOffer called');
    const pc = setupPeerConnection();
    
    // For laptop (receiver), we need to add a dummy transceiver to ensure proper SDP generation
    if (role === 'laptop') {
      console.log('[useWebRTC] Adding receiver transceiver for laptop');
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
    
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
        }, 15000);
      }
    });
    
    await iceGatheringPromise;
    console.log('[useWebRTC] Offer created and set as local description', offer);
    return offer;
  }, [setupPeerConnection, role]);

  const setRemoteOffer = React.useCallback(async (sdp: string) => {
    try {
      // Ensure we start fresh for every incoming offer to avoid transceiver/order mismatches
      if (pcRef.current) {
        console.log('[useWebRTC] Closing existing peer connection before applying new remote offer');
        pcRef.current.close();
        pcRef.current = null;
      }

      const pc = setupPeerConnection();
      console.log('[useWebRTC] setRemoteOffer: incoming offer length=', sdp?.length);
      await pc.setRemoteDescription({ type: 'offer', sdp });
      console.log('[useWebRTC] setRemoteOffer: pc.remoteDescription.type=', pc.remoteDescription?.type, 'pc.remoteDescription.sdpLength=', pc.remoteDescription?.sdp?.length);

      // If we already have a local stream (camera started), attach tracks now in a way that
      // preserves the m-line/transceiver ordering coming from the offer.
      const localStream = (useStore as any).getState ? (useStore as any).getState().localStream : undefined;
      if (localStream) {
        const transceivers = pc.getTransceivers();
        localStream.getTracks().forEach((track: MediaStreamTrack) => {
          let attached = false;
          for (const tr of transceivers) {
            try {
              // If transceiver receiver exists and its kind matches, reuse it
              if (tr.receiver && tr.receiver.track && tr.receiver.track.kind === track.kind) {
                if (tr.sender) {
                  try {
                    tr.sender.replaceTrack(track);
                  } catch (e) {
                    // ignore replaceTrack errors
                  }
                  tr.direction = 'sendrecv';
                  attached = true;
                  break;
                }
              }
            } catch (e) {
              // continue
            }
          }
          if (!attached) {
            pc.addTrack(track, localStream);
          }
        });
      }
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
      }, 15000);
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
        const pc = pcRef.current;
        // Guard: if already connected or stable with an answer, do nothing
        if (pc.connectionState === 'connected') {
          console.log('[useWebRTC] Already connected; ignoring duplicate answer');
          toast({ title: 'Already Connected', description: 'The connection is already established.' });
          return;
        }
        if (pc.signalingState === 'stable' && pc.remoteDescription?.type === 'answer') {
          console.log('[useWebRTC] Signaling state stable and answer already set; skipping');
          return;
        }
        // Validate we have a local offer before setting the answer
        if (!pc.localDescription || pc.localDescription.type !== 'offer') {
          console.warn('[useWebRTC] Cannot set answer without a local offer. Current signalingState:', pc.signalingState);
          toast({ title: 'Offer missing', description: 'Create an offer first, then paste the phone\'s answer.', variant: 'destructive' });
          return;
        }

        console.log('[useWebRTC] Setting remote description (answer)');
        await pc.setRemoteDescription({ type: 'answer', sdp });
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
