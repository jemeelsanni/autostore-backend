"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting database seed...');
    const hashedPassword = await bcryptjs_1.default.hash('admin123', 10);
    const superAdmin = await prisma.user.upsert({
        where: { email: 'admin@jajiautos.ng' },
        update: {},
        create: {
            email: 'admin@jajiautos.ng',
            username: 'superadmin',
            password: hashedPassword,
            firstName: 'Super',
            lastName: 'Admin',
            role: client_1.Role.SUPER_ADMIN
        }
    });
    const salesPerson = await prisma.user.upsert({
        where: { email: 'sales@jajiautos.ng' },
        update: {},
        create: {
            email: 'sales@jajiautos.ng',
            username: 'salesperson',
            password: await bcryptjs_1.default.hash('sales123', 10),
            firstName: 'John',
            lastName: 'Doe',
            role: client_1.Role.SALES_PERSONNEL
        }
    });
    const inventoryManager = await prisma.user.upsert({
        where: { email: 'inventory@jajiautos.ng' },
        update: {},
        create: {
            email: 'inventory@jajiautos.ng',
            username: 'inventorymanager',
            password: await bcryptjs_1.default.hash('inventory123', 10),
            firstName: 'Jane',
            lastName: 'Smith',
            role: client_1.Role.INVENTORY_MANAGER
        }
    });
    const carsData = [
        {
            name: 'Mercedes-Benz GLE 450',
            brand: 'Mercedes-Benz',
            model: 'GLE 450',
            price: 45000000,
            originalPrice: 48000000,
            images: [
                'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80',
                'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80'
            ],
            category: 'Luxury SUV',
            year: 2023,
            mileage: 15000,
            fuel: 'Gasoline',
            transmission: 'Automatic',
            engine: '3.0L V6 Turbo',
            horsepower: 362,
            torque: '369 lb-ft',
            acceleration: '5.7 seconds',
            topSpeed: '250 km/h',
            fuelEconomy: '12.8L/100km',
            drivetrain: 'AWD',
            exteriorColor: 'Obsidian Black',
            interiorColor: 'Black Leather',
            vin: 'WDC0G4KB5LF123456',
            description: 'Experience luxury and performance with the Mercedes-Benz GLE 450. This premium SUV combines elegant design with cutting-edge technology.',
            features: [
                'MBUX Infotainment System',
                'Panoramic Sunroof',
                'Heated & Ventilated Seats',
                'Premium Audio System',
                'Navigation System'
            ],
            safetyFeatures: [
                'Active Brake Assist',
                'Blind Spot Assist',
                'Lane Keeping Assist',
                'Adaptive Cruise Control'
            ],
            warranty: '4 years / 80,000 km',
            featured: true,
            inStock: 3,
            isNew: true,
            dealType: 'Hot Deal',
            addedById: inventoryManager.id
        },
        {
            name: 'BMW X5 xDrive40i',
            brand: 'BMW',
            model: 'X5 xDrive40i',
            price: 42000000,
            originalPrice: 44000000,
            images: [
                'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80',
                'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80'
            ],
            category: 'Luxury SUV',
            year: 2023,
            mileage: 8000,
            fuel: 'Gasoline',
            transmission: 'Automatic',
            engine: '3.0L Inline-6 Turbo',
            horsepower: 335,
            torque: '330 lb-ft',
            acceleration: '5.5 seconds',
            topSpeed: '244 km/h',
            fuelEconomy: '11.9L/100km',
            drivetrain: 'AWD',
            exteriorColor: 'Alpine White',
            interiorColor: 'Cognac Leather',
            vin: '5UXCR6C59L0123456',
            description: 'The BMW X5 combines sporty performance with luxurious comfort, featuring the latest BMW technology and design.',
            features: [
                'iDrive 7.0 System',
                'Gesture Control',
                'Wireless Charging',
                'Harman Kardon Audio',
                'Head-Up Display'
            ],
            safetyFeatures: [
                'Forward Collision Warning',
                'Automatic Emergency Braking',
                'Lane Departure Warning',
                'Parking Assistant'
            ],
            warranty: '4 years / 80,000 km',
            featured: true,
            inStock: 2,
            isNew: true,
            addedById: inventoryManager.id
        },
        {
            name: 'Audi Q7 Premium Plus',
            brand: 'Audi',
            model: 'Q7 Premium Plus',
            price: 38000000,
            originalPrice: 40000000,
            images: [
                'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80',
                'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80'
            ],
            category: 'Luxury SUV',
            year: 2022,
            mileage: 25000,
            fuel: 'Gasoline',
            transmission: 'Automatic',
            engine: '3.0L V6 TFSI',
            horsepower: 335,
            torque: '369 lb-ft',
            acceleration: '5.7 seconds',
            topSpeed: '250 km/h',
            fuelEconomy: '12.1L/100km',
            drivetrain: 'AWD',
            exteriorColor: 'Glacier White',
            interiorColor: 'Black Leather',
            vin: 'WA1LAAF79JD123456',
            description: 'The Audi Q7 offers a perfect blend of luxury, technology, and performance with its spacious interior and advanced features.',
            features: [
                'MMI Touch Response',
                'Virtual Cockpit Plus',
                'Bang & Olufsen Audio',
                '4-Zone Climate Control',
                'Power Tailgate'
            ],
            safetyFeatures: [
                'Audi Pre Sense',
                'Traffic Sign Recognition',
                'Side Assist',
                'Rear Cross Traffic Alert'
            ],
            warranty: '4 years / 80,000 km',
            featured: true,
            inStock: 4,
            isNew: false,
            addedById: inventoryManager.id
        },
        {
            name: 'Porsche Cayenne S',
            brand: 'Porsche',
            model: 'Cayenne S',
            price: 52000000,
            originalPrice: 52000000,
            images: [
                'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=800&q=80',
                'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=800&q=80'
            ],
            category: 'Sports SUV',
            year: 2023,
            mileage: 5000,
            fuel: 'Gasoline',
            transmission: 'Automatic',
            engine: '2.9L V6 Twin-Turbo',
            horsepower: 434,
            torque: '405 lb-ft',
            acceleration: '5.0 seconds',
            topSpeed: '265 km/h',
            fuelEconomy: '13.2L/100km',
            drivetrain: 'AWD',
            exteriorColor: 'Racing Yellow',
            interiorColor: 'Black Leather',
            vin: 'WP1AB2A59KLA12345',
            description: 'The Porsche Cayenne S delivers sports car performance in an SUV package, with exceptional handling and luxury.',
            features: [
                'PCM 6.0 System',
                'Sport Chrono Package',
                'Air Suspension',
                'Bose Audio System',
                'Sport Seats Plus'
            ],
            safetyFeatures: [
                'Porsche InnoDrive',
                'Lane Change Assist',
                'Traffic Jam Assist',
                'ParkAssist'
            ],
            warranty: '4 years / 80,000 km',
            featured: true,
            inStock: 1,
            isNew: true,
            dealType: 'Limited Edition',
            addedById: inventoryManager.id
        },
        {
            name: 'Toyota Camry XLE',
            brand: 'Toyota',
            model: 'Camry XLE',
            price: 18000000,
            originalPrice: 19000000,
            images: [
                'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80',
                'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80'
            ],
            category: 'Sedan',
            year: 2023,
            mileage: 12000,
            fuel: 'Gasoline',
            transmission: 'Automatic',
            engine: '2.5L 4-Cylinder',
            horsepower: 203,
            torque: '184 lb-ft',
            acceleration: '8.4 seconds',
            topSpeed: '200 km/h',
            fuelEconomy: '8.1L/100km',
            drivetrain: 'FWD',
            exteriorColor: 'Celestial Silver',
            interiorColor: 'Black Fabric',
            vin: '4T1G11AK5PU123456',
            description: 'The Toyota Camry XLE offers reliability, efficiency, and comfort with modern technology and safety features.',
            features: [
                'Toyota Safety Sense 2.0',
                'Entune 3.0 Audio',
                'Wireless Device Charging',
                'Smart Key System',
                'Dual-Zone Climate Control'
            ],
            safetyFeatures: [
                'Pre-Collision System',
                'Lane Departure Alert',
                'Automatic High Beams',
                'Dynamic Radar Cruise Control'
            ],
            warranty: '3 years / 60,000 km',
            featured: false,
            inStock: 5,
            isNew: true,
            addedById: inventoryManager.id
        }
    ];
    for (const carData of carsData) {
        await prisma.car.create({
            data: {
                name: carData.name,
                brand: carData.brand,
                model: carData.model,
                price: carData.price,
                originalPrice: carData.originalPrice,
                images: carData.images,
                category: carData.category,
                year: carData.year,
                mileage: carData.mileage,
                fuel: carData.fuel,
                transmission: carData.transmission,
                engine: carData.engine,
                horsepower: carData.horsepower,
                torque: carData.torque,
                acceleration: carData.acceleration,
                topSpeed: carData.topSpeed,
                fuelEconomy: carData.fuelEconomy,
                drivetrain: carData.drivetrain,
                exteriorColor: carData.exteriorColor,
                interiorColor: carData.interiorColor,
                vin: carData.vin,
                description: carData.description,
                features: carData.features,
                safetyFeatures: carData.safetyFeatures,
                warranty: carData.warranty,
                featured: carData.featured,
                inStock: carData.inStock,
                isNew: carData.isNew,
                dealType: carData.dealType,
                addedById: carData.addedById
            }
        });
    }
    const cars = await prisma.car.findMany();
    const salesData = [
        {
            carId: cars[0].id,
            customerName: 'Ahmed Ibrahim',
            customerEmail: 'ahmed.ibrahim@email.com',
            customerPhone: '+234 803 123 4567',
            amount: cars[0].price,
            status: client_1.SaleStatus.COMPLETED,
            paymentMethod: 'Bank Transfer',
            notes: 'Customer requested extended warranty',
            salespersonId: salesPerson.id
        },
        {
            carId: cars[1].id,
            customerName: 'Fatima Okafor',
            customerEmail: 'fatima.okafor@email.com',
            customerPhone: '+234 805 987 6543',
            amount: cars[1].price,
            status: client_1.SaleStatus.COMPLETED,
            paymentMethod: 'Card',
            notes: 'Financing arrangement completed',
            salespersonId: salesPerson.id
        },
        {
            carId: cars[2].id,
            customerName: 'Chinedu Okwu',
            customerEmail: 'chinedu.okwu@email.com',
            customerPhone: '+234 807 456 7890',
            amount: cars[2].price,
            status: client_1.SaleStatus.PENDING,
            paymentMethod: 'Financing',
            notes: 'Pending final documentation',
            salespersonId: salesPerson.id
        }
    ];
    for (const saleData of salesData) {
        await prisma.sale.create({
            data: {
                carId: saleData.carId,
                customerName: saleData.customerName,
                customerEmail: saleData.customerEmail,
                customerPhone: saleData.customerPhone,
                amount: saleData.amount,
                status: saleData.status,
                paymentMethod: saleData.paymentMethod,
                notes: saleData.notes,
                salespersonId: saleData.salespersonId
            }
        });
    }
    const reviewsData = [
        {
            carId: cars[0].id,
            userId: superAdmin.id,
            rating: 5,
            comment: 'Excellent vehicle with outstanding performance and luxury features.'
        },
        {
            carId: cars[0].id,
            userId: salesPerson.id,
            rating: 4,
            comment: 'Great SUV, customers love the technology and comfort.'
        },
        {
            carId: cars[1].id,
            userId: inventoryManager.id,
            rating: 5,
            comment: 'BMW quality and performance at its finest.'
        },
        {
            carId: cars[2].id,
            userId: superAdmin.id,
            rating: 4,
            comment: 'Solid luxury SUV with good value for money.'
        },
        {
            carId: cars[3].id,
            userId: salesPerson.id,
            rating: 5,
            comment: 'Pure sports car DNA in SUV form. Amazing performance!'
        }
    ];
    for (const reviewData of reviewsData) {
        await prisma.review.create({
            data: {
                carId: reviewData.carId,
                userId: reviewData.userId,
                rating: reviewData.rating,
                comment: reviewData.comment
            }
        });
    }
    console.log('✅ Database seeded successfully!');
    console.log('👤 Users created:');
    console.log(`   - Super Admin: admin@jajiautos.ng / admin123`);
    console.log(`   - Sales Personnel: sales@jajiautos.ng / sales123`);
    console.log(`   - Inventory Manager: inventory@jajiautos.ng / inventory123`);
    console.log(`🚗 Created ${carsData.length} cars`);
    console.log(`💰 Created ${salesData.length} sales`);
    console.log(`⭐ Created ${reviewsData.length} reviews`);
    console.log(`ℹ️  Settings creation commented out - run migration first`);
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map