"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const client_1 = require("@prisma/client");
const streamifier_1 = __importDefault(require("streamifier"));
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 6
    }
});
const authenticateToken = (req, res, next) => {
    req.user = { id: 'user_1', role: 'SUPER_ADMIN' };
    next();
};
const uploadToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder: 'jajiautos/cars',
            public_id: `car-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            transformation: [
                { width: 1200, height: 800, crop: 'limit' },
                { quality: 'auto:good' },
                { format: 'auto' }
            ],
            resource_type: 'image'
        }, (error, result) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(result);
            }
        });
        streamifier_1.default.createReadStream(buffer).pipe(uploadStream);
    });
};
router.post('/upload/image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        console.log('📤 Uploading to Cloudinary...');
        const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
        console.log('✅ Image uploaded to Cloudinary:', result.secure_url);
        return res.json({
            url: result.secure_url,
            filename: result.public_id,
            size: result.bytes
        });
    }
    catch (error) {
        console.error('❌ Cloudinary upload error:', error);
        return res.status(500).json({ error: 'Failed to upload image to Cloudinary' });
    }
});
router.post('/upload/multiple', upload.array('images', 6), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No image files provided' });
        }
        const files = req.files;
        const uploadedImages = [];
        console.log(`📤 Uploading ${files.length} images to Cloudinary...`);
        for (const file of files) {
            const result = await uploadToCloudinary(file.buffer, file.originalname);
            uploadedImages.push({
                url: result.secure_url,
                filename: result.public_id,
                size: result.bytes
            });
        }
        console.log(`✅ ${uploadedImages.length} images uploaded to Cloudinary`);
        return res.json(uploadedImages);
    }
    catch (error) {
        console.error('❌ Cloudinary multiple upload error:', error);
        return res.status(500).json({ error: 'Failed to upload images to Cloudinary' });
    }
});
router.delete('/upload/image/:publicId', async (req, res) => {
    try {
        const publicId = req.params.publicId;
        const result = await cloudinary_1.v2.uploader.destroy(publicId);
        if (result.result === 'ok') {
            console.log('✅ Image deleted from Cloudinary:', publicId);
            res.json({ message: 'Image deleted successfully' });
        }
        else {
            res.status(404).json({ error: 'Image not found' });
        }
    }
    catch (error) {
        console.error('❌ Cloudinary deletion error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search;
        const category = req.query.category;
        const brand = req.query.brand;
        const featured = req.query.featured === 'true';
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (category && category !== 'all')
            where.category = category;
        if (brand && brand !== 'all')
            where.brand = brand;
        if (featured)
            where.featured = true;
        const [cars, total] = await Promise.all([
            prisma.car.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { featured: 'desc' },
                    { createdAt: 'desc' }
                ],
                include: {
                    _count: { select: { reviews: true } },
                    reviews: { select: { rating: true } }
                }
            }),
            prisma.car.count({ where })
        ]);
        const carsWithRating = cars.map(car => {
            const avgRating = car.reviews.length > 0
                ? car.reviews.reduce((sum, review) => sum + review.rating, 0) / car.reviews.length
                : 0;
            return {
                ...car,
                rating: Number(avgRating.toFixed(1)),
                reviews: car._count.reviews
            };
        });
        res.json({
            cars: carsWithRating,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('❌ Error fetching cars:', error);
        res.status(500).json({ error: 'Failed to fetch cars' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const car = await prisma.car.findUnique({
            where: { id: req.params.id },
            include: {
                _count: { select: { reviews: true } },
                reviews: {
                    select: { rating: true, comment: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });
        if (!car) {
            return res.status(404).json({ error: 'Car not found' });
        }
        const avgRating = car.reviews.length > 0
            ? car.reviews.reduce((sum, review) => sum + review.rating, 0) / car.reviews.length
            : 0;
        const carWithRating = {
            ...car,
            rating: Number(avgRating.toFixed(1)),
            reviewCount: car._count.reviews
        };
        return res.json(carWithRating);
    }
    catch (error) {
        console.error('❌ Error fetching car:', error);
        return res.status(500).json({ error: 'Failed to fetch car' });
    }
});
router.post('/', async (req, res) => {
    try {
        console.log('🚗 Creating new car with data:', req.body);
        const { name, brand, model, price, originalPrice, images, category, year, mileage, fuel, transmission, engine, horsepower, description, features, safetyFeatures, inStock, warranty, featured, isNew, torque, acceleration, topSpeed, fuelEconomy, drivetrain, exteriorColor, interiorColor, vin } = req.body;
        if (!name || !brand || !model || !price || !category || !year || !description || !features || inStock === undefined) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['name', 'brand', 'model', 'price', 'category', 'year', 'description', 'features', 'inStock'],
                received: Object.keys(req.body)
            });
        }
        if (!images || !Array.isArray(images) || images.length === 0) {
            console.log('❌ Images validation failed:', images);
            return res.status(400).json({ error: 'At least one image is required' });
        }
        const carData = {
            name: name.trim(),
            brand: brand.trim(),
            model: model.trim(),
            price: parseFloat(price),
            originalPrice: originalPrice ? parseFloat(originalPrice) : parseFloat(price),
            images: Array.isArray(images) ? images : [images],
            category: category.trim(),
            year: parseInt(year),
            mileage: mileage ? parseInt(mileage) : 0,
            fuel: fuel || 'Gasoline',
            transmission: transmission || 'Automatic',
            engine: engine?.trim() || null,
            horsepower: horsepower ? parseInt(horsepower) : null,
            torque: torque?.trim() || null,
            acceleration: acceleration?.trim() || null,
            topSpeed: topSpeed?.trim() || null,
            fuelEconomy: fuelEconomy?.trim() || null,
            drivetrain: drivetrain?.trim() || null,
            exteriorColor: exteriorColor?.trim() || null,
            interiorColor: interiorColor?.trim() || null,
            vin: vin?.trim() || null,
            description: description.trim(),
            features: Array.isArray(features) ? features : features.split(',').map((f) => f.trim()),
            safetyFeatures: safetyFeatures ?
                (Array.isArray(safetyFeatures) ? safetyFeatures : safetyFeatures.split(',').map((f) => f.trim())) :
                [],
            warranty: warranty?.trim() || null,
            featured: Boolean(featured),
            isNew: Boolean(isNew !== false),
            inStock: parseInt(inStock),
            dealType: null
        };
        console.log('📝 Prepared car data:', {
            ...carData,
            images: `Array(${carData.images.length})`,
            features: `Array(${carData.features.length})`
        });
        const car = await prisma.car.create({
            data: carData,
            include: {
                _count: { select: { reviews: true } }
            }
        });
        console.log(`✅ Car created successfully: ${car.name} (ID: ${car.id})`);
        return res.status(201).json(car);
    }
    catch (error) {
        console.error('❌ Error creating car:', error);
        if (typeof error === 'object' && error !== null && 'code' in error) {
            const prismaError = error;
            if (prismaError.code === 'P2002') {
                return res.status(400).json({
                    error: 'A car with this name already exists',
                    field: prismaError.meta?.target
                });
            }
            if (prismaError.code === 'P2000') {
                return res.status(400).json({
                    error: 'Value too long for field',
                    details: prismaError.meta
                });
            }
            if (prismaError.code === 'P2025') {
                return res.status(400).json({
                    error: 'Referenced record not found',
                    details: prismaError.meta
                });
            }
            console.error('Full error details:', {
                message: prismaError.message,
                code: prismaError.code,
                meta: prismaError.meta,
                stack: prismaError.stack
            });
            return res.status(500).json({
                error: 'Failed to create car',
                details: process.env.NODE_ENV === 'development' ? prismaError.message : undefined
            });
        }
        else {
            return res.status(500).json({ error: 'Failed to create car' });
        }
    }
});
router.put('/:id', async (req, res) => {
    try {
        const carId = req.params.id;
        const updateData = { ...req.body };
        if (updateData.features && typeof updateData.features === 'string') {
            updateData.features = updateData.features.split(',').map((f) => f.trim());
        }
        if (updateData.safetyFeatures && typeof updateData.safetyFeatures === 'string') {
            updateData.safetyFeatures = updateData.safetyFeatures.split(',').map((f) => f.trim());
        }
        if (updateData.price)
            updateData.price = parseFloat(updateData.price);
        if (updateData.year)
            updateData.year = parseInt(updateData.year);
        if (updateData.inStock !== undefined)
            updateData.inStock = parseInt(updateData.inStock);
        if (updateData.featured !== undefined)
            updateData.featured = Boolean(updateData.featured);
        delete updateData.id;
        delete updateData.createdAt;
        delete updateData.addedById;
        const updatedCar = await prisma.car.update({
            where: { id: carId },
            data: updateData
        });
        res.json(updatedCar);
    }
    catch (error) {
        console.error('❌ Error updating car:', error);
        res.status(500).json({ error: 'Failed to update car' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const carId = req.params.id;
        const existingCar = await prisma.car.findUnique({ where: { id: carId } });
        if (!existingCar) {
            return res.status(404).json({ error: 'Car not found' });
        }
        if (existingCar.images && Array.isArray(existingCar.images)) {
            for (const imageUrl of existingCar.images) {
                try {
                    const publicId = imageUrl.split('/').slice(-1)[0].split('.')[0];
                    await cloudinary_1.v2.uploader.destroy(`jajiautos/cars/${publicId}`);
                }
                catch (error) {
                    console.log('Failed to delete image from Cloudinary:', error);
                }
            }
        }
        await prisma.car.delete({ where: { id: carId } });
        return res.json({ message: 'Car deleted successfully' });
    }
    catch (error) {
        console.error('❌ Error deleting car:', error);
        return res.status(500).json({ error: 'Failed to delete car' });
    }
});
router.get('/featured/list', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 6;
        const featuredCars = await prisma.car.findMany({
            where: { featured: true, inStock: { gt: 0 } },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { reviews: true } },
                reviews: { select: { rating: true } }
            }
        });
        const carsWithRating = featuredCars.map(car => {
            const avgRating = car.reviews.length > 0
                ? car.reviews.reduce((sum, review) => sum + review.rating, 0) / car.reviews.length
                : 0;
            return {
                ...car,
                rating: Number(avgRating.toFixed(1)),
                reviews: car._count.reviews
            };
        });
        res.json({ cars: carsWithRating });
    }
    catch (error) {
        console.error('❌ Error fetching featured cars:', error);
        res.json({ cars: [] });
    }
});
exports.default = router;
//# sourceMappingURL=cars.js.map