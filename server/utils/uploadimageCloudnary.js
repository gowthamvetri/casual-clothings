import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET_KEY
})

const uploadImageClodinary = async(image) => {
    try {
        // Validate Cloudinary configuration
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET_KEY) {
            console.error('Cloudinary config missing:', {
                hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
                hasApiKey: !!process.env.CLOUDINARY_API_KEY,
                hasApiSecret: !!process.env.CLOUDINARY_API_SECRET_KEY
            });
            throw new Error('Cloudinary configuration is incomplete. Please check environment variables.');
        }

        if (!image || !image.buffer) {
            throw new Error('Invalid image data provided');
        }

        console.log('Starting Cloudinary upload for image:', {
            originalname: image.originalname,
            mimetype: image.mimetype,
            size: image.size,
            bufferLength: image.buffer?.length
        });

        const buffer = image.buffer || Buffer.from(await image.arrayBuffer())

        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { 
                    folder: "Casual Clothing Fashion",
                    resource_type: "image",
                    quality: "auto",
                    fetch_format: "auto",
                    timeout: 60000 // 60 seconds timeout
                },
                (error, uploadResult) => {
                    if (error) {
                        console.error('Cloudinary upload stream error:', {
                            message: error.message,
                            http_code: error.http_code,
                            name: error.name
                        });
                        reject(error);
                    } else {
                        console.log('Cloudinary upload success:', {
                            public_id: uploadResult.public_id,
                            url: uploadResult.secure_url,
                            format: uploadResult.format,
                            size: uploadResult.bytes
                        });
                        resolve(uploadResult);
                    }
                }
            );

            // Write buffer and end the stream
            uploadStream.end(buffer);
        })

        return uploadResult
        
    } catch (error) {
        console.error('uploadImageClodinary error:', {
            message: error.message,
            name: error.name,
            code: error.code,
            http_code: error.http_code
        });
        throw error;
    }
}

export default uploadImageClodinary