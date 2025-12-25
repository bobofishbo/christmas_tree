// Copyright 2023 The MediaPipe Authors.
// Licensed under the Apache License, Version 2.0

import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let handLandmarker = undefined;
let runningMode = "IMAGE";
let webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;

// Explosion control - this will be set from the main script
window.handDetection = {
  targetExplosionFactor: 0,
  isPalmOpen: false,
  leftHand: { fingers: 0, details: null },
  rightHand: { fingers: 0, details: null },
  showRandomImage: false,
  randomImageIndex: null,
  swipeStartX: null, // Starting position when gesture begins
  swipeThreshold: 0.1, // Minimum movement to trigger swipe (10% of screen)
  swipeLocked: false, // Lock swiping for 2 seconds after a swipe
  swipeLockTimeout: null, // Timeout reference for unlocking
  leftHandStartPos: null, // Starting position of left hand when palm opens
  treeRotationSpeed: 0, // Rotation speed adjustment from up/down movement
  treeRotationOffset: 0 // Rotation offset for tree (from left/right movement)
};

// Check if only index finger is pointing (not palm open, just index finger)
function isIndexFingerPointing(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  
  const fingerCount = countFingersLifted(landmarks);
  
  // Only index finger should be extended (thumb can be extended too, that's okay for pointing)
  // Index finger pointing: index=true, others=false (thumb can be either)
  const isPointing = fingerCount.index === true && 
                     fingerCount.middle === false && 
                     fingerCount.ring === false && 
                     fingerCount.pinky === false;
  
  return isPointing;
}

// Instructions panel is static, no update function needed

// Create HandLandmarker
const createHandLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: runningMode,
    numHands: 2
  });
  console.log('HandLandmarker loaded successfully');
  
  // Auto-start webcam when ready
  if (hasGetUserMedia() && !webcamRunning) {
    enableCam();
  }
};
createHandLandmarker();

// Check if webcam access is supported
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

// Automatically enable the live webcam view and start detection
function enableCam() {
  if (!handLandmarker) {
    console.log("Wait! handLandmarker not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    return; // Already running
  }

  webcamRunning = true;

  // getUsermedia parameters
  const constraints = {
    video: true
  };

  // Activate the webcam stream
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
    
    // Show webcam view and debug panel
    const webcamView = document.getElementById('webcamView');
    if (webcamView) {
      webcamView.classList.add('active');
    }
    
    // Instructions panel is always visible, no need to activate
  }).catch((error) => {
    console.error("Error accessing webcam:", error);
    const debugStatus = document.getElementById('debugStatus');
    if (debugStatus) {
      debugStatus.textContent = "Status: Camera access denied or unavailable";
      debugStatus.style.color = "#FF0000";
    }
  });
}

// Calculate 2D distance helper function
const getDistance2D = (p1, p2) => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

// Count the number of fingers lifted/extended on a hand
// Returns an object with counts for each finger type and total
function countFingersLifted(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
      total: 0
    };
  }
  
  // MediaPipe hand landmarks indices:
  // Wrist: 0
  // Thumb: 4 (tip), 3 (IP), 2 (MCP), 1 (CMC)
  // Index: 8 (tip), 7 (DIP), 6 (PIP), 5 (MCP)
  // Middle: 12 (tip), 11 (DIP), 10 (PIP), 9 (MCP)
  // Ring: 16 (tip), 15 (DIP), 14 (PIP), 13 (MCP)
  // Pinky: 20 (tip), 19 (DIP), 18 (PIP), 17 (MCP)
  
  const wrist = landmarks[0];
  
  // Check thumb (special case - check if thumb tip is away from index finger base)
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const thumbMCP = landmarks[2];
  const indexMCP = landmarks[5];
  // Thumb is extended if tip is further from wrist than IP, and away from index finger
  const thumbExtended = getDistance2D(thumbTip, wrist) > getDistance2D(thumbIP, wrist) * 1.1 &&
                        getDistance2D(thumbTip, indexMCP) > getDistance2D(thumbMCP, indexMCP) * 0.8;
  
  // Check index finger
  const indexTip = landmarks[8];
  const indexPIP = landmarks[6];
  const indexExtended = getDistance2D(indexTip, wrist) > getDistance2D(indexPIP, wrist) * 1.1;
  
  // Check middle finger
  const middleTip = landmarks[12];
  const middlePIP = landmarks[10];
  const middleExtended = getDistance2D(middleTip, wrist) > getDistance2D(middlePIP, wrist) * 1.1;
  
  // Check ring finger
  const ringTip = landmarks[16];
  const ringPIP = landmarks[14];
  const ringExtended = getDistance2D(ringTip, wrist) > getDistance2D(ringPIP, wrist) * 1.1;
  
  // Check pinky finger
  const pinkyTip = landmarks[20];
  const pinkyPIP = landmarks[18];
  const pinkyExtended = getDistance2D(pinkyTip, wrist) > getDistance2D(pinkyPIP, wrist) * 1.1;
  
  // Count total extended fingers
  const total = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
    .filter(Boolean).length;
  
  return {
    thumb: thumbExtended,
    index: indexExtended,
    middle: middleExtended,
    ring: ringExtended,
    pinky: pinkyExtended,
    total: total
  };
}

// Check if palm is open based on hand landmarks
function isPalmOpen(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  
  // Get key points
  const wrist = landmarks[0];
  const indexTip = landmarks[8];
  const indexPIP = landmarks[6];
  const middleTip = landmarks[12];
  const middlePIP = landmarks[10];
  const ringTip = landmarks[16];
  const ringPIP = landmarks[14];
  const pinkyTip = landmarks[20];
  const pinkyPIP = landmarks[18];
  
  // A finger is extended if the tip is further from wrist than the PIP joint
  // This is more reliable than just checking distance to wrist
  const indexExtended = getDistance2D(indexTip, wrist) > getDistance2D(indexPIP, wrist) * 1.1;
  const middleExtended = getDistance2D(middleTip, wrist) > getDistance2D(middlePIP, wrist) * 1.1;
  const ringExtended = getDistance2D(ringTip, wrist) > getDistance2D(ringPIP, wrist) * 1.1;
  const pinkyExtended = getDistance2D(pinkyTip, wrist) > getDistance2D(pinkyPIP, wrist) * 1.1;
  
  // Palm is open if at least 4 fingers are extended (all except thumb)
  const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended]
    .filter(Boolean).length;
  
  return extendedCount >= 4;
}

async function predictWebcam() {
  // Make sure video has dimensions
  if (!video.videoWidth || !video.videoHeight) {
    if (webcamRunning === true) {
      window.requestAnimationFrame(predictWebcam);
    }
    return;
  }
  
  // Get the actual displayed video size (not the video element's natural size)
  const videoContainer = video.parentElement;
  const displayedWidth = videoContainer.clientWidth;
  const displayedHeight = videoContainer.clientHeight;
  
  // Set canvas to match the displayed video size (not the video's natural dimensions)
  // This ensures the overlay matches what you see on screen
  if (canvasElement.width !== displayedWidth || canvasElement.height !== displayedHeight) {
    canvasElement.width = displayedWidth;
    canvasElement.height = displayedHeight;
  }
  
  // Calculate how the video is displayed (accounting for object-fit: cover)
  // object-fit: cover maintains aspect ratio and fills container, may crop
  const videoAspect = video.videoWidth / video.videoHeight;
  const containerAspect = displayedWidth / displayedHeight;
  
  let scaleX, scaleY, offsetX = 0, offsetY = 0;
  
  if (videoAspect > containerAspect) {
    // Video is wider - will be cropped on left/right
    // Height fills container, width is cropped
    scaleY = displayedHeight / video.videoHeight;
    scaleX = scaleY; // Maintain aspect ratio
    const scaledWidth = video.videoWidth * scaleX;
    offsetX = (scaledWidth - displayedWidth) / 2;
  } else {
    // Video is taller - will be cropped on top/bottom
    // Width fills container, height is cropped
    scaleX = displayedWidth / video.videoWidth;
    scaleY = scaleX; // Maintain aspect ratio
    const scaledHeight = video.videoHeight * scaleY;
    offsetY = (scaledHeight - displayedHeight) / 2;
  }
  
  // Now let's start detecting the stream
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
  }
  
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
  }
  
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // Reset hand tracking
  window.handDetection.leftHand = { fingers: 0, details: null };
  window.handDetection.rightHand = { fingers: 0, details: null };
  
  // Check for palm open and update explosion factor
  // ONLY left hand controls the tree - right hand does nothing
  let palmOpen = false;
  if (results && results.landmarks && results.landmarks.length > 0) {
    // Process each detected hand and separate by screen position
    // Simple heuristic: if hand is on right side of screen, it's the left hand (mirror view)
    results.landmarks.forEach((landmarks, index) => {
      if (!landmarks || landmarks.length < 21) return;
      
      // Get the wrist position (landmark 0) to determine screen position
      // MediaPipe coordinates are normalized (0-1), where 0 is left, 1 is right
      const wristX = landmarks[0].x;
      
      // Count fingers for this hand
      const fingerCount = countFingersLifted(landmarks);
      
      // If hand is on right side of screen (x > 0.5), it's the left hand
      // If hand is on left side of screen (x < 0.5), it's the right hand
      if (wristX > 0.5) {
        // Right side of screen = left hand (controls tree)
        window.handDetection.leftHand = {
          fingers: fingerCount.total,
          details: fingerCount,
          landmarks: landmarks // Store landmarks for gesture detection
        };
        
        // Only check if left hand palm is open for explosion
        if (isPalmOpen(landmarks)) {
          palmOpen = true;
          
          // Track left hand position for tree control
          const wrist = landmarks[0];
          const currentX = wrist.x;
          const currentY = wrist.y;
          
          // Initialize start position when palm first opens
          if (window.handDetection.leftHandStartPos === null) {
            window.handDetection.leftHandStartPos = { x: currentX, y: currentY };
          }
          
          // Calculate movement from start position
          const deltaX = currentX - window.handDetection.leftHandStartPos.x;
          const deltaY = currentY - window.handDetection.leftHandStartPos.y;
          
          // Map horizontal movement (X) to tree rotation
          // Moving right (positive deltaX) = rotate right, moving left (negative deltaX) = rotate left
          // Scale: full screen width (1.0) = 360 degrees rotation
          window.handDetection.treeRotationOffset = deltaX * 360;
          
          // Map vertical movement (Y) to Z-axis rotation
          // Moving hand up (negative deltaY) = rotate faster in current direction
          // Moving hand down (positive deltaY) = rotate slower or reverse
          // Scale: full screen height (1.0) = 360 degrees rotation speed adjustment
          window.handDetection.treeRotationSpeed = -deltaY * 360; // Negative deltaY (hand up) = positive speed (faster rotation)
        } else {
          // Palm closed - reset start position
          window.handDetection.leftHandStartPos = null;
          window.handDetection.treeRotationSpeed = 0;
          window.handDetection.treeRotationOffset = 0;
        }
      } else {
        // Left side of screen = right hand
        window.handDetection.rightHand = {
          fingers: fingerCount.total,
          details: fingerCount,
          landmarks: landmarks // Store landmarks for gesture detection
        };
        // Right hand does not control tree - no palm check
      }
    });
    
    // Check for gesture: left hand palm open + right hand index finger pointing
    // Only if left hand is palm open, will right hand actions do anything
    const leftHandOpen = window.handDetection.leftHand.landmarks && 
                        isPalmOpen(window.handDetection.leftHand.landmarks);
    
    const rightHandPointing = window.handDetection.rightHand.landmarks && 
                              isIndexFingerPointing(window.handDetection.rightHand.landmarks);
    
    if (leftHandOpen && rightHandPointing) {
      // Both conditions met - bring one image to the front
      const rightHandIndexTip = window.handDetection.rightHand.landmarks[8]; // Index finger tip
      const currentX = rightHandIndexTip.x;
      
      // Get the number of available images
      const numImages = window.portraitImages ? window.portraitImages.length : 4;
      
      if (!window.handDetection.showRandomImage) {
        // Select random image index when pointing starts
        window.handDetection.randomImageIndex = Math.floor(Math.random() * numImages);
        window.handDetection.showRandomImage = true;
        // Store starting position for swipe detection
        window.handDetection.swipeStartX = currentX;
        window.handDetection.swipeLocked = false;
        console.log(`Image brought to front: ${window.handDetection.randomImageIndex}`);
      } else {
        // Gesture is active - check for swipe (only if not locked)
        if (window.handDetection.swipeStartX !== null && !window.handDetection.swipeLocked) {
          const deltaX = currentX - window.handDetection.swipeStartX;
          
          // Swipe right (moving right on screen = left swipe) - go to previous image
          if (deltaX > window.handDetection.swipeThreshold) {
            window.handDetection.randomImageIndex = (window.handDetection.randomImageIndex - 1 + numImages) % numImages;
            window.handDetection.swipeStartX = currentX; // Reset start position
            window.handDetection.swipeLocked = true;
            console.log(`Swiped left, showing image: ${window.handDetection.randomImageIndex}`);
            
            // Clear any existing timeout
            if (window.handDetection.swipeLockTimeout) {
              clearTimeout(window.handDetection.swipeLockTimeout);
            }
            
            // Unlock after 2 seconds
            window.handDetection.swipeLockTimeout = setTimeout(() => {
              window.handDetection.swipeLocked = false;
              // Reset start position to current position after lock
              if (window.handDetection.rightHand.landmarks) {
                window.handDetection.swipeStartX = window.handDetection.rightHand.landmarks[8].x;
              }
              console.log('Swipe lock released');
            }, 2000);
          }
          // Swipe left (moving left on screen = right swipe) - go to next image
          else if (deltaX < -window.handDetection.swipeThreshold) {
            window.handDetection.randomImageIndex = (window.handDetection.randomImageIndex + 1) % numImages;
            window.handDetection.swipeStartX = currentX; // Reset start position
            window.handDetection.swipeLocked = true;
            console.log(`Swiped right, showing image: ${window.handDetection.randomImageIndex}`);
            
            // Clear any existing timeout
            if (window.handDetection.swipeLockTimeout) {
              clearTimeout(window.handDetection.swipeLockTimeout);
            }
            
            // Unlock after 2 seconds
            window.handDetection.swipeLockTimeout = setTimeout(() => {
              window.handDetection.swipeLocked = false;
              // Reset start position to current position after lock
              if (window.handDetection.rightHand.landmarks) {
                window.handDetection.swipeStartX = window.handDetection.rightHand.landmarks[8].x;
              }
              console.log('Swipe lock released');
            }, 2000);
          }
        }
      }
    } else {
      // Gesture not active - hide the image and reset swipe tracking
      window.handDetection.showRandomImage = false;
      window.handDetection.randomImageIndex = null;
      window.handDetection.swipeStartX = null;
      window.handDetection.swipeLocked = false;
      // Clear any pending timeout
      if (window.handDetection.swipeLockTimeout) {
        clearTimeout(window.handDetection.swipeLockTimeout);
        window.handDetection.swipeLockTimeout = null;
      }
    }
    
    // Draw hand landmarks with proper connections
    // MediaPipe landmarks are in normalized coordinates (0-1), need to convert to pixel coordinates
    for (const landmarks of results.landmarks) {
      if (!landmarks || landmarks.length < 21) continue;
      
      // Hand connections (based on MediaPipe hand structure)
      const connections = [
        // Thumb
        [0, 1], [1, 2], [2, 3], [3, 4],
        // Index finger
        [0, 5], [5, 6], [6, 7], [7, 8],
        // Middle finger
        [0, 9], [9, 10], [10, 11], [11, 12],
        // Ring finger
        [0, 13], [13, 14], [14, 15], [15, 16],
        // Pinky
        [0, 17], [17, 18], [18, 19], [19, 20],
        // Palm connections
        [5, 9], [9, 13], [13, 17]
      ];
      
      // Draw connections
      // MediaPipe landmarks are normalized (0-1) relative to video natural size
      // Need to scale to displayed canvas size, accounting for object-fit: cover cropping
      canvasCtx.strokeStyle = "#00FF00";
      canvasCtx.lineWidth = 2;
      for (const [start, end] of connections) {
        if (landmarks[start] && landmarks[end]) {
          // Convert normalized coordinates (0-1) to video natural pixels, then scale to displayed size
          const x1 = landmarks[start].x * video.videoWidth * scaleX - offsetX;
          const y1 = landmarks[start].y * video.videoHeight * scaleY - offsetY;
          const x2 = landmarks[end].x * video.videoWidth * scaleX - offsetX;
          const y2 = landmarks[end].y * video.videoHeight * scaleY - offsetY;
          
          canvasCtx.beginPath();
          canvasCtx.moveTo(x1, y1);
          canvasCtx.lineTo(x2, y2);
          canvasCtx.stroke();
        }
      }
      
      // Draw landmark points
      canvasCtx.fillStyle = "#FF0000";
      for (const landmark of landmarks) {
        // Convert normalized coordinates (0-1) to video natural pixels, then scale to displayed size
        const x = landmark.x * video.videoWidth * scaleX - offsetX;
        const y = landmark.y * video.videoHeight * scaleY - offsetY;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 4, 0, Math.PI * 2);
        canvasCtx.fill();
      }
    }
  }
  
  // Update explosion factor based on palm detection
  window.handDetection.isPalmOpen = palmOpen;
  window.handDetection.targetExplosionFactor = palmOpen ? 1 : 0;
  
  canvasCtx.restore();

  // Call this function again to keep predicting when the browser is ready
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

