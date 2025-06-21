/*
 * bodySegmentation.js - Optimized Capture-Based Body Segmentation
 * MEMORY AND PERFORMANCE OPTIMIZED VERSION
 * 
 * Key optimizations:
 * - Eliminated console logging for better performance
 * - Proper graphics object disposal to prevent memory leaks
 * - Simplified processing pipeline
 * - Better error handling without spam
 * - Reduced memory allocations
 */

let captureBodySegmentation = null;
let captureInProgress = false;
let graphicsBuffer = null; // Reusable graphics buffer

// Optimized configuration for clean captures
const captureSegmentationOptions = {
    maskType: "background",
    segmentationThreshold: 0.3, // Lower threshold for cleaner captures
    // outputStride: 16, // Reduced stride for better performance
    // quantBytes: 2, // Reduced quantization for lower memory usage
    runtime: "tfjs",    
    // internalResolution: "low",
    // multiSegmentation: true, // Single segmentation for simplicity
    // modelType: "general",
    architecture: 'MobileNetV1',
    flipped: true
    
};

/**
 * Initialize body segmentation for commemorative captures
 * Optimized for minimal memory footprint and clean resource management
 */
function initializeBodySegmentationForCapture(videoElement, onCaptureComplete) {
    if (captureInProgress) return;
    
    captureInProgress = true;
    
    if (!captureBodySegmentation) {
        captureBodySegmentation = ml5.bodySegmentation("BodyPix", captureSegmentationOptions, modelLoaded);
    } else {
        performSingleCapture(videoElement, onCaptureComplete);
    }
    
    function modelLoaded() {
        performSingleCapture(videoElement, onCaptureComplete);
    }
}

/**
 * Perform optimized single capture with proper cleanup
 */
function performSingleCapture(videoElement, onCaptureComplete) {
    if (!captureBodySegmentation) {
        captureInProgress = false;
        return;
    }
    
    captureBodySegmentation.detect(videoElement, (result) => {
        handleCaptureResult(result, onCaptureComplete);
    });
}

/**
 * Handle capture results with memory-conscious processing
 */
function handleCaptureResult(result, onCaptureComplete) {
    captureInProgress = false;
    
    if (!result || !result.mask) {
        if (onCaptureComplete) onCaptureComplete(null);
        return;
    }
    
    // Process with optimized enhancement
    const enhancedResult = enhanceForCommemorative(result);
    
    if (onCaptureComplete) {
        onCaptureComplete(enhancedResult);
    }
}

/**
 * Memory-optimized commemorative enhancement
 * Reuses graphics buffers and cleans up properly
 */
function enhanceForCommemorative(result) {
    result.mask.loadPixels();
    
    // Create or reuse graphics buffer to prevent memory buildup
    if (!graphicsBuffer || 
        graphicsBuffer.width !== result.mask.width || 
        graphicsBuffer.height !== result.mask.height) {
        
        if (graphicsBuffer) {
            graphicsBuffer.remove(); // Clean up old buffer
        }
        graphicsBuffer = createGraphics(result.mask.width, result.mask.height);
    }
    
    const commemorativeMask = applyCommemoratveEnhancement(result.mask);
    
    return {
        mask: commemorativeMask,
        data: result.data,
        imageData: result.imageData,
        isCommemorative: true
    };
}

/**
 * Simplified morphological operations optimized for performance
 * Reduced kernel size and optimized pixel access patterns
 */
function applyCommemoratveEnhancement(originalMask) {
    graphicsBuffer.loadPixels();
    
    const kernelSize = 3; // Smaller kernel for better performance
    const halfKernel = Math.floor(kernelSize / 2);
    const width = originalMask.width;
    const height = originalMask.height;
    
    // Optimized morphological closing operation
    for (let y = halfKernel; y < height - halfKernel; y++) {
        for (let x = halfKernel; x < width - halfKernel; x++) {
            let maxAlpha = 0;
            
            // Efficient kernel processing
            for (let ky = -halfKernel; ky <= halfKernel; ky++) {
                for (let kx = -halfKernel; kx <= halfKernel; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    const alpha = originalMask.pixels[idx + 3];
                    if (alpha > maxAlpha) maxAlpha = alpha;
                }
            }
            
            const idx = (y * width + x) * 4;
            graphicsBuffer.pixels[idx] = 0;
            graphicsBuffer.pixels[idx + 1] = 0;
            graphicsBuffer.pixels[idx + 2] = 0;
            graphicsBuffer.pixels[idx + 3] = maxAlpha;
        }
    }
    
    graphicsBuffer.updatePixels();
    return graphicsBuffer;
}

/**
 * Clean up resources to prevent memory leaks
 */
function disposeCaptureResources() {
    if (graphicsBuffer) {
        graphicsBuffer.remove();
        graphicsBuffer = null;
    }
    captureBodySegmentation = null;
}

function isCaptureReady() {
    return captureBodySegmentation !== null && !captureInProgress;
}

function getCaptureInfo() {
    return {
        modelLoaded: captureBodySegmentation !== null,
        captureInProgress: captureInProgress,
        optimizedFor: "memory_efficient_capture"
    };
}