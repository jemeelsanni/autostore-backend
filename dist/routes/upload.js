"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const sharp_1 = __importDefault(require("sharp"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const ensureUploadDir = () => {
    const uploadDir = path_1.default.join(__dirname, '../../uploads/cars');
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
        console.log(`📁 Created upload directory: ${uploadDir}`);
    }
};
ensureUploadDir();
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(__dirname, '../../uploads/cars');
        ensureUploadDir();
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `car-${(0, uuid_1.v4)()}-${Date.now()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
};
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 6
    }
});
const authenticateToken = (req, res, next) => {
    req.user = { id: 'user_1', role: 'SUPER_ADMIN' };
    next();
};
const requireRole = (roles) => (req, res, next) => {
    if (roles.includes(req.user.role)) {
        next();
    }
    else {
        res.status(403).json({ error: 'Insufficient permissions' });
    }
};
const optimizeImage = async (inputPath, outputPath) => {
    await (0, sharp_1.default)(inputPath)
        .resize(1200, 800, {
        fit: 'inside',
        withoutEnlargement: true
    })
        .jpeg({ quality: 85 })
        .toFile(outputPath);
};
router.post('/upload/image', authenticateToken, requireRole(['INVENTORY_MANAGER', 'SUPER_ADMIN']), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No image file provided' });
            return;
        }
        const originalPath = req.file.path;
        const optimizedFilename = `optimized-${req.file.filename}`;
        const optimizedPath = path_1.default.join(path_1.default.dirname(originalPath), optimizedFilename);
        await optimizeImage(originalPath, optimizedPath);
        fs_1.default.unlinkSync(originalPath);
        const imageUrl = `/uploads/cars/${optimizedFilename}`;
        console.log(`✅ Image uploaded successfully: ${imageUrl}`);
        res.json({
            url: imageUrl,
            filename: optimizedFilename,
            size: fs_1.default.statSync(optimizedPath).size
        });
    }
    catch (error) {
        console.error('❌ Image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});
router.post('/upload/multiple', authenticateToken, requireRole(['INVENTORY_MANAGER', 'SUPER_ADMIN']), upload.array('images', 6), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            res.status(400).json({ error: 'No image files provided' });
            return;
        }
        const uploadedImages = [];
        const files = req.files;
        for (const file of files) {
            const originalPath = file.path;
            const optimizedFilename = `optimized-${file.filename}`;
            const optimizedPath = path_1.default.join(path_1.default.dirname(originalPath), optimizedFilename);
            await optimizeImage(originalPath, optimizedPath);
            fs_1.default.unlinkSync(originalPath);
            const imageUrl = `/uploads/cars/${optimizedFilename}`;
            uploadedImages.push({
                url: imageUrl,
                filename: optimizedFilename,
                size: fs_1.default.statSync(optimizedPath).size
            });
        }
        console.log(`✅ ${uploadedImages.length} images uploaded successfully`);
        res.json(uploadedImages);
    }
    catch (error) {
        console.error('❌ Multiple image upload error:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});
router.delete('/upload/image/:filename', authenticateToken, requireRole(['INVENTORY_MANAGER', 'SUPER_ADMIN']), async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path_1.default.join(__dirname, '../../uploads/cars', filename);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
            console.log(`🗑️ Image deleted from filesystem: ${filename}`);
        }
        console.log(`✅ Image deleted successfully: ${filename}`);
        res.json({ message: 'Image deleted successfully' });
    }
    catch (error) {
        console.error('❌ Image deletion error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});
router.get('/', async (req, res) => {
    try {
        console.log('GET /api/cars - Fetching cars...');
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search;
        const category = req.query.category;
        const brand = req.query.brand;
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : undefined;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined;
        const featured = req.query.featured === 'true';
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (category && category !== 'all')
            where.category = category;
        if (brand && brand !== 'all')
            where.brand = brand;
        if (featured)
            where.featured = true;
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice)
                where.price.gte = minPrice;
            if (maxPrice)
                where.price.lte = maxPrice;
        }
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
                    _count: {
                        select: { reviews: true }
                    },
                    reviews: {
                        select: {
                            rating: true
                        }
                    }
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
        console.log(`✅ Found ${cars.length} cars (total: ${total})`);
        res.json({
            cars: carsWithRating || [],
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
        res.json({
            cars: [
                {
                    id: '1',
                    name: 'Mercedes-Benz C-Class 2023',
                    brand: 'Mercedes-Benz',
                    model: 'C-Class',
                    price: 45000000,
                    originalPrice: 50000000,
                    images: ['https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80'],
                    category: 'Sedan',
                    year: 2023,
                    mileage: 15000,
                    fuel: 'Gasoline',
                    transmission: 'Automatic',
                    engine: '2.0L Turbo I4',
                    horsepower: 255,
                    description: 'Experience luxury and performance with this pristine Mercedes-Benz C-Class.',
                    features: ['Leather Seats', 'Navigation System', 'Sunroof', 'Premium Sound'],
                    safetyFeatures: ['ABS', 'Multiple Airbags', 'Stability Control'],
                    inStock: 3,
                    featured: true,
                    rating: 4.8,
                    reviews: 24,
                    isNew: true,
                    warranty: '3 years / 100,000 km',
                    createdAt: new Date().toISOString(),
                    _count: { reviews: 24 }
                },
                {
                    id: '2',
                    name: 'Toyota Camry 2024',
                    brand: 'Toyota',
                    model: 'Camry',
                    price: 35000000,
                    originalPrice: 35000000,
                    images: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80'],
                    category: 'Sedan',
                    year: 2024,
                    mileage: 0,
                    fuel: 'Gasoline',
                    transmission: 'Automatic',
                    engine: '2.5L I4',
                    horsepower: 203,
                    description: 'Reliable and efficient family sedan with modern features.',
                    features: ['Bluetooth', 'Backup Camera', 'Lane Assist', 'Cruise Control'],
                    safetyFeatures: ['Toyota Safety Sense', 'Blind Spot Monitor'],
                    inStock: 8,
                    featured: false,
                    rating: 4.5,
                    reviews: 156,
                    isNew: true,
                    warranty: '5 years / 150,000 km',
                    createdAt: new Date().toISOString(),
                    _count: { reviews: 156 }
                }
            ],
            pagination: {
                page: 1,
                limit: 50,
                total: 2,
                totalPages: 1
            }
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const car = await prisma.car.findUnique({
            where: { id: req.params.id },
            include: {
                _count: {
                    select: { reviews: true }
                },
                reviews: {
                    select: {
                        rating: true,
                        comment: true,
                        createdAt: true
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });
        if (!car) {
            res.status(404).json({ error: 'Car not found' });
            return;
        }
        const avgRating = car.reviews.length > 0
            ? car.reviews.reduce((sum, review) => sum + review.rating, 0) / car.reviews.length
            : 0;
        const carWithRating = {
            ...car,
            rating: Number(avgRating.toFixed(1)),
            reviewCount: car._count.reviews
        };
        console.log(`✅ Found car: ${car.name}`);
        res.json(carWithRating);
    }
    catch (error) {
        console.error('❌ Error fetching car:', error);
        res.status(500).json({ error: 'Failed to fetch car' });
    }
});
router.post('/', authenticateToken, requireRole(['INVENTORY_MANAGER', 'SUPER_ADMIN']), async (req, res) => {
    try {
        console.log('🚗 Creating new car:', req.body);
        const { name, brand, model, price, originalPrice, images, category, year, mileage, fuel, transmission, engine, horsepower, torque, acceleration, topSpeed, fuelEconomy, drivetrain, exteriorColor, interiorColor, vin, description, features, safetyFeatures, inStock, warranty, featured, isNew } = req.body;
        if (!name || !brand || !model || !price || !category || !year || !description || !features || inStock === undefined) {
            res.status(400).json({
                error: 'Missing required fields: name, brand, model, price, category, year, description, features, inStock'
            });
            return;
        }
        if (!images || !Array.isArray(images) || images.length === 0) {
            res.status(400).json({ error: 'At least one image is required' });
            return;
        }
        const carData = {
            name: name.trim(),
            brand: brand.trim(),
            model: model.trim(),
            price: parseFloat(price),
            originalPrice: originalPrice ? parseFloat(originalPrice) : parseFloat(price),
            images,
            category: category.trim(),
            year: parseInt(year),
            mileage: mileage ? parseInt(mileage) : 0,
            fuel: fuel || 'Gasoline',
            transmission: transmission || 'Automatic',
            engine: engine?.trim() || undefined,
            horsepower: horsepower ? parseInt(horsepower) : undefined,
            torque: torque?.trim() || undefined,
            acceleration: acceleration?.trim() || undefined,
            topSpeed: topSpeed?.trim() || undefined,
            fuelEconomy: fuelEconomy?.trim() || undefined,
            drivetrain: drivetrain?.trim() || undefined,
            exteriorColor: exteriorColor?.trim() || undefined,
            interiorColor: interiorColor?.trim() || undefined,
            vin: vin?.trim() || undefined,
            description: description.trim(),
            features: Array.isArray(features) ? features : features.split(',').map((f) => f.trim()),
            safetyFeatures: safetyFeatures ? (Array.isArray(safetyFeatures) ? safetyFeatures : safetyFeatures.split(',').map((f) => f.trim())) : [],
            inStock: parseInt(inStock),
            warranty: warranty?.trim() || undefined,
            featured: Boolean(featured),
            isNew: Boolean(isNew !== false),
            addedById: req.user?.userId ?? null
        };
        const car = await prisma.car.create({
            data: carData,
            include: {
                _count: {
                    select: { reviews: true }
                }
            }
        });
        console.log(`✅ Car created successfully: ${car.name} (ID: ${car.id})`);
        res.status(201).json(car);
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
            res.status(400).json({ error: 'A car with this name already exists' });
            return;
        }
        res.status(500).json({ error: 'Failed to create car' });
        return;
    }
});
router.put('/:id', authenticateToken, requireRole(['INVENTORY_MANAGER', 'SUPER_ADMIN']), async (req, res) => {
    try {
        const carId = req.params.id;
        console.log(`🔄 Updating car: ${carId}`);
        const existingCar = await prisma.car.findUnique({
            where: { id: carId }
        });
        if (!existingCar) {
            return res.status(404).json({ error: 'Car not found' });
        }
        const updateData = { ...req.body };
        if (updateData.features && typeof updateData.features === 'string') {
            updateData.features = updateData.features.split(',').map((f) => f.trim());
        }
        if (updateData.safetyFeatures && typeof updateData.safetyFeatures === 'string') {
            updateData.safetyFeatures = updateData.safetyFeatures.split(',').map((f) => f.trim());
        }
        if (updateData.price)
            updateData.price = parseFloat(updateData.price);
        if (updateData.originalPrice)
            updateData.originalPrice = parseFloat(updateData.originalPrice);
        if (updateData.year)
            updateData.year = parseInt(updateData.year);
        if (updateData.mileage)
            updateData.mileage = parseInt(updateData.mileage);
        if (updateData.horsepower)
            updateData.horsepower = parseInt(updateData.horsepower);
        if (updateData.inStock !== undefined)
            updateData.inStock = parseInt(updateData.inStock);
        if (updateData.featured !== undefined)
            updateData.featured = Boolean(updateData.featured);
        if (updateData.isNew !== undefined)
            updateData.isNew = Boolean(updateData.isNew);
        delete updateData.id;
        delete updateData.createdAt;
        delete updateData.addedById;
        const updatedCar = await prisma.car.update({
            where: { id: carId },
            data: updateData,
            include: {
                _count: {
                    select: { reviews: true }
                }
            }
        });
        console.log(`✅ Car updated successfully: ${updatedCar.name}`);
        return res.json(updatedCar);
    }
    catch (error) {
        console.error('❌ Error updating car:', error);
        return res.status(500).json({ error: 'Failed to update car' });
    }
});
router.delete('/:id', authenticateToken, requireRole(['INVENTORY_MANAGER', 'SUPER_ADMIN']), async (req, res) => {
    try {
        const carId = req.params.id;
        console.log(`🗑️ Deleting car: ${carId}`);
        const existingCar = await prisma.car.findUnique({
            where: { id: carId }
        });
        if (!existingCar) {
            return res.status(404).json({ error: 'Car not found' });
        }
        if (existingCar.images && Array.isArray(existingCar.images)) {
            for (const imageUrl of existingCar.images) {
                const filename = path_1.default.basename(imageUrl);
                const filePath = path_1.default.join(__dirname, '../../uploads/cars', filename);
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                    console.log(`🗑️ Deleted image: ${filename}`);
                }
            }
        }
        await prisma.car.delete({
            where: { id: carId }
        });
        console.log(`✅ Car deleted successfully: ${carId}`);
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
            where: {
                featured: true,
                inStock: { gt: 0 }
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { reviews: true }
                },
                reviews: {
                    select: {
                        rating: true
                    }
                }
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
        console.log(`✅ Found ${featuredCars.length} featured cars`);
        res.json({ cars: carsWithRating });
    }
    catch (error) {
        console.error('❌ Error fetching featured cars:', error);
        res.json({ cars: [] });
    }
});
router.get('/categories/list', async (req, res) => {
    try {
        const categories = await prisma.car.groupBy({
            by: ['category'],
            _count: {
                category: true
            },
            where: {
                inStock: { gt: 0 }
            },
            orderBy: {
                _count: {
                    category: 'desc'
                }
            }
        });
        const formattedCategories = categories.map(cat => ({
            name: cat.category,
            count: cat._count.category
        }));
        console.log(`✅ Found ${categories.length} categories`);
        res.json({ categories: formattedCategories });
    }
    catch (error) {
        console.error('❌ Error fetching categories:', error);
        res.json({ categories: [] });
    }
});
router.get('/brands/list', async (req, res) => {
    try {
        const brands = await prisma.car.groupBy({
            by: ['brand'],
            _count: {
                brand: true
            },
            where: {
                inStock: { gt: 0 }
            },
            orderBy: {
                brand: 'asc'
            }
        });
        const formattedBrands = brands.map(brand => ({
            name: brand.brand,
            count: brand._count.brand
        }));
        console.log(`✅ Found ${brands.length} brands`);
        res.json({ brands: formattedBrands });
    }
    catch (error) {
        console.error('❌ Error fetching brands:', error);
        res.json({ brands: [] });
    }
});
router.get('/search/query', async (req, res) => {
    try {
        const query = req.query.q;
        const limit = parseInt(req.query.limit) || 10;
        if (!query || query.trim().length < 2) {
            res.status(400).json({ error: 'Search query must be at least 2 characters' });
            return;
        }
        const cars = await prisma.car.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { brand: { contains: query, mode: 'insensitive' } },
                    { model: { contains: query, mode: 'insensitive' } },
                    { category: { contains: query, mode: 'insensitive' } }
                ],
                inStock: { gt: 0 }
            },
            take: limit,
            select: {
                id: true,
                name: true,
                brand: true,
                model: true,
                price: true,
                images: true,
                category: true
            },
            orderBy: [
                { featured: 'desc' },
                { name: 'asc' }
            ]
        });
        console.log(`✅ Found ${cars.length} cars for search: "${query}"`);
        res.json({ cars, query });
        return;
    }
    catch (error) {
        console.error('❌ Error searching cars:', error);
        res.json({ cars: [], query: req.query.q });
        return;
    }
});
router.use((error, req, res, next) => {
    if (error instanceof multer_1.default.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Maximum is 6 images.' });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ error: 'Unexpected field name for file upload.' });
        }
    }
    if (error.message === 'Only JPEG, PNG, and WebP images are allowed') {
        return res.status(400).json({ error: error.message });
    }
    console.error('❌ Route error:', error);
    res.status(500).json({ error: 'Internal server error' });
});
exports.default = router;
//# sourceMappingURL=upload.js.map