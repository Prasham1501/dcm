/**
 * Fix Image Loading - Updates image loader to use correct endpoints
 * This file should be loaded AFTER cornerstone-init.js
 */

(function() {
    console.log('Applying image loading fixes...');
    
    // Override the image loading to use correct endpoints
    const originalLoad = cornerstoneWADOImageLoader.wadouri.loadImage;
    
    cornerstoneWADOImageLoader.wadouri.loadImage = function(imageId) {
        console.log('Loading image:', imageId);
        
        // Check if this is an Orthanc image
        if (imageId.includes('orthancInstanceId=')) {
            // Extract the instance ID
            const match = imageId.match(/orthancInstanceId=([^&]+)/);
            if (match && match[1]) {
                const instanceId = match[1];
                
                // Build the correct URL based on environment
                let apiUrl;
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    // Local: Use Orthanc directly
                    apiUrl = `http://localhost:8042/instances/${instanceId}/file`;
                } else {
                    // Remote: Use storage API
                    apiUrl = `/dicom/api/get_dicom_from_storage.php?instanceId=${instanceId}`;
                }
                
                console.log('Loading from:', apiUrl);
                
                // Create new imageId with correct URL
                const newImageId = `wadouri:${apiUrl}`;
                return originalLoad.call(this, newImageId);
            }
        }
        
        // Not an Orthanc image, use original loader
        return originalLoad.call(this, imageId);
    };
    
    console.log('Image loading fixes applied');
})();

// Also add helper function to window.DICOM_VIEWER namespace
window.DICOM_VIEWER.getImageUrl = function(image) {
    if (!image) return null;
    
    // Check if this is from Orthanc/PACS
    if (image.isOrthancImage && image.orthancInstanceId) {
        const instanceId = image.orthancInstanceId;
        
        // Determine the correct endpoint
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Local development - direct to Orthanc
            return `wadouri:http://localhost:8042/instances/${instanceId}/file`;
        } else {
            // Production - use storage API
            return `wadouri:/dicom/api/get_dicom_from_storage.php?instanceId=${instanceId}`;
        }
    }
    
    // Regular uploaded file
    if (image.id) {
        return `wadouri:get_dicom_file.php?id=${image.id}`;
    }
    
    return null;
};

console.log('Image URL helper added to DICOM_VIEWER');
