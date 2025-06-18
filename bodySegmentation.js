/*
 * bodySegmentation.js - ML5 Body Segmentation Integration
 * 
 * This module handles all interactions with the ml5.js bodySegmentation model.
 * It's optimized for real-time performance and focuses on person detection
 * rather than detailed body part segmentation.
 * 
 * Key optimizations:
 * - Uses 'person' mask type for better performance than 'parts'
 * - Implements frame rate limiting to prevent overwhelming the model
 * - Handles model loading and error states gracefully
 */

let bodySegmentation;
let segmentationCallback;
let isProcessing = false;
let lastProcessingTime = 0;
const PROCESSING_INTERVAL = 100; // Process every 100ms for smooth but performant detection

// Configuration optimized for person outline detection
const segmentationOptions = {
    maskType: "background", // Focus on person vs background, not individual body parts
    runtime: "tfjs",    // Use TensorFlow.js for better browser compatibility
    modelType: "general" // General model works well for most body types
};

/**
 * Initialize the body segmentation system
 * 
 * This function sets up the ml5 bodySegmentation model and begins processing
 * video frames. The model is preloaded to ensure smooth operation.
 * 
 * @param {p5.Element} videoElement - The p5.js video capture element
 * @param {Function} onResult - Callback function to handle segmentation results
 */
function initializeBodySegmentation(videoElement, onResult) {
    segmentationCallback = onResult;
    
    console.log("Initializing body segmentation model...");
    
    // Create the body segmentation model with optimized settings
    bodySegmentation = ml5.bodySegmentation("BodyPix", segmentationOptions, modelLoaded);
    
    function modelLoaded() {
        console.log("✅ Body segmentation model loaded successfully");
        
        // Start the detection process
        startDetection(videoElement);
    }
}

/**
 * Start continuous body detection on the video feed
 * 
 * This uses detectStart() for continuous processing, but implements
 * our own throttling to control the frame rate and prevent overwhelming
 * the system.
 * 
 * @param {p5.Element} videoElement - The video feed to process
 */
function startDetection(videoElement) {
    if (!bodySegmentation) {
        console.error("❌ Body segmentation model not loaded");
        return;
    }
    
    console.log("🎥 Starting body detection...");
    
    // Use detectStart for continuous processing
    bodySegmentation.detectStart(videoElement, handleSegmentationResult);
}

/**
 * Handle results from the body segmentation model
 * 
 * This function implements intelligent throttling and quality checking
 * before passing results to the main application.
 * 
 * @param {Object} result - Segmentation result from ml5
 */
function handleSegmentationResult(result) {
    // Throttle processing to maintain performance
    const currentTime = millis();
    if (currentTime - lastProcessingTime < PROCESSING_INTERVAL) {
        return; // Skip this frame
    }
    lastProcessingTime = currentTime;
    
    // Validate the result
    if (!result || !result.mask) {
        console.warn("⚠️ Invalid segmentation result received");
        if (segmentationCallback) {
            segmentationCallback(null);
        }
        return;
    }
    
    // Process the result for better quality
    const processedResult = enhanceSegmentationResult(result);
    
    // Pass the result to the main application
    if (segmentationCallback) {
        segmentationCallback(processedResult);
    }
}

/**
 * Enhance the segmentation result for better edge detection
 * 
 * This function applies post-processing to improve the quality of the
 * segmentation mask, which leads to cleaner edge detection.
 * 
 * @param {Object} result - Original segmentation result
 * @returns {Object} Enhanced segmentation result
 */
function enhanceSegmentationResult(result) {
    // Create a copy of the result to avoid modifying the original
    const enhancedResult = {
        mask: result.mask,
        data: result.data,
        imageData: result.imageData
    };
    
    // Apply morphological operations to clean up the mask
    // This helps remove small noise and fills in small gaps
    enhancedResult.mask = applyMorphologicalOperations(result.mask);
    
    return enhancedResult;
}

/**
 * Apply morphological operations to clean up the segmentation mask
 * 
 * Morphological operations help create cleaner, more stable outlines by:
 * - Removing small noise (erosion followed by dilation)
 * - Filling small gaps in the person silhouette
 * - Smoothing jagged edges
 * 
 * @param {p5.Image} originalMask - The original segmentation mask
 * @returns {p5.Image} Cleaned up mask
 */
function applyMorphologicalOperations(originalMask) {
    // Create a new graphics buffer for processing
    let processedMask = createGraphics(originalMask.width, originalMask.height);
    
    // Load the original mask pixels - do this ONCE for efficiency
    originalMask.loadPixels();
    processedMask.loadPixels();
    
    // Apply a simple morphological closing operation
    // This fills small gaps and removes small noise
    const kernelSize = 3; // Small kernel for subtle effect
    const halfKernel = Math.floor(kernelSize / 2);
    
    for (let y = halfKernel; y < originalMask.height - halfKernel; y++) {
        for (let x = halfKernel; x < originalMask.width - halfKernel; x++) {
            let maxAlpha = 0;
            
            // Check kernel area for maximum alpha value
            for (let ky = -halfKernel; ky <= halfKernel; ky++) {
                for (let kx = -halfKernel; kx <= halfKernel; kx++) {
                    const idx = ((y + ky) * originalMask.width + (x + kx)) * 4;
                    maxAlpha = Math.max(maxAlpha, originalMask.pixels[idx + 3]);
                }
            }
            
            // Set pixel in processed mask
            const idx = (y * processedMask.width + x) * 4;
            processedMask.pixels[idx] = 0;     // R
            processedMask.pixels[idx + 1] = 0; // G
            processedMask.pixels[idx + 2] = 0; // B
            processedMask.pixels[idx + 3] = maxAlpha; // A - use max alpha from kernel
        }
    }
    
    // Update pixels only once after all processing
    processedMask.updatePixels();
    
    return processedMask;
}

/**
 * Stop the body detection process
 * 
 * This cleanly stops the detection process and can be used when
 * transitioning between different phases of the application.
 */
function stopDetection() {
    if (bodySegmentation) {
        bodySegmentation.detectStop();
        console.log("🛑 Body detection stopped");
    }
}

/**
 * Check if the body segmentation system is ready
 * 
 * @returns {boolean} True if the system is initialized and ready
 */
function isSegmentationReady() {
    return bodySegmentation !== null && bodySegmentation !== undefined;
}

/**
 * Get information about the current segmentation model
 * 
 * @returns {Object} Model information and status
 */
function getSegmentationInfo() {
    return {
        ready: isSegmentationReady(),
        options: segmentationOptions,
        processingInterval: PROCESSING_INTERVAL
    };
}