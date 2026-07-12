import { prisma } from "../database/prisma.js";
import { hashPassword } from "../utils/password.js";

const demoUsers = [
  { name: "Aditi Rao", email: "admin@assetflow.demo", role: "Admin", password: "Admin@12345" },
  { name: "Rohan Mehta", email: "manager@assetflow.demo", role: "AssetManager", password: "Manager@12345" },
  { name: "Sana Iqbal", email: "head@assetflow.demo", role: "DepartmentHead", password: "Head@12345" },
  { name: "Priya Sharma", email: "priya@assetflow.demo", role: "Employee", password: "Priya@12345" },
  { name: "Raj Verma", email: "raj@assetflow.demo", role: "Employee", password: "Raj@12345" },
  { name: "Kunal P", email: "kunalpitale6@gmail.com", role: "Employee", password: "Kunal@12345" },
];

const demoDepartments = [
  { name: "Information Technology", description: "Manages IT hardware, software, and support.", headEmail: "manager@assetflow.demo" },
  { name: "Operations", description: "Runs day-to-day organizational operations.", headEmail: "head@assetflow.demo" },
  { name: "Facilities", description: "Maintains buildings, rooms, and shared spaces.", parentName: "Operations" },
  { name: "Finance", description: "Handles budgeting and financial planning." },
];

const demoCategories = [
  {
    name: "Electronics",
    description: "Laptops, phones, projectors, and other electronic devices.",
    customFields: [
      { key: "warrantyMonths", label: "Warranty (months)", type: "number", required: false },
    ],
  },
  { name: "Furniture", description: "Desks, chairs, and office furniture." },
  { name: "Vehicles", description: "Company cars, vans, and other vehicles." },
  {
    name: "Equipment",
    description: "Shared rooms, cameras, and bookable equipment.",
    customFields: [
      { key: "capacity", label: "Capacity", type: "number", required: false },
    ],
  },
];

// registeredByEmail defaults to the Asset Manager below.
const demoAssets = [
  { assetTag: "AF-0001", name: "Dell Latitude 5450", category: "Electronics", serialNumber: "DL5450-8841", condition: "Good", location: "IT Store Room", acquisitionCost: 82000, warrantyMonths: 24 },
  { assetTag: "AF-0002", name: "MacBook Pro 14", category: "Electronics", serialNumber: "MBP14-2231", condition: "Excellent", location: "IT Store Room", acquisitionCost: 189000, warrantyMonths: 12 },
  { assetTag: "AF-0003", name: "Epson Projector EB-2250U", category: "Electronics", serialNumber: "EPS-2250-01", condition: "Good", location: "AV Cupboard", acquisitionCost: 65000, isSharedResource: true, warrantyMonths: 18 },
  { assetTag: "AF-0004", name: "iPhone 15", category: "Electronics", serialNumber: "IP15-7781", condition: "Excellent", location: "IT Store Room", acquisitionCost: 79900, warrantyMonths: 12 },
  { assetTag: "AF-0005", name: "Ergonomic Chair", category: "Furniture", condition: "Good", location: "Floor 2", acquisitionCost: 14000 },
  { assetTag: "AF-0006", name: "Standing Desk", category: "Furniture", condition: "Good", location: "Floor 2", acquisitionCost: 22000 },
  { assetTag: "AF-0007", name: "Toyota Innova Crysta", category: "Vehicles", serialNumber: "MH01-AB-1234", condition: "Good", location: "Basement Parking", acquisitionCost: 2100000, isSharedResource: true },
  { assetTag: "AF-0008", name: "Conference Room B2", category: "Equipment", condition: "Good", location: "Floor 1", isSharedResource: true, capacity: 12 },
  { assetTag: "AF-0009", name: "Conference Room A1", category: "Equipment", condition: "Good", location: "Floor 1", isSharedResource: true, capacity: 6 },
  { assetTag: "AF-0010", name: "Canon EOS R6 Camera", category: "Equipment", serialNumber: "CAN-R6-5521", condition: "Excellent", location: "Media Cupboard", acquisitionCost: 240000, isSharedResource: true },
];

async function seedUsers() {
  const usersByEmail = {};

  for (const demoUser of demoUsers) {
    const passwordHash = await hashPassword(demoUser.password);
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: { name: demoUser.name, role: demoUser.role, status: "Active", passwordHash },
      create: {
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        status: "Active",
        passwordHash,
      },
      select: { userId: true, email: true },
    });

    usersByEmail[user.email] = user.userId;
  }

  return usersByEmail;
}

async function seedDepartments(usersByEmail) {
  const departmentsByName = {};

  // First pass: create/update without parent so parents always exist first.
  for (const department of demoDepartments) {
    const record = await prisma.department.upsert({
      where: { name: department.name },
      update: {
        description: department.description ?? null,
        headUserId: department.headEmail ? usersByEmail[department.headEmail] : null,
        status: "Active",
      },
      create: {
        name: department.name,
        description: department.description ?? null,
        headUserId: department.headEmail ? usersByEmail[department.headEmail] : null,
        status: "Active",
      },
      select: { departmentId: true, name: true },
    });

    departmentsByName[record.name] = record.departmentId;
  }

  // Second pass: wire up parent hierarchy.
  for (const department of demoDepartments) {
    if (department.parentName) {
      await prisma.department.update({
        where: { name: department.name },
        data: { parentDepartmentId: departmentsByName[department.parentName] },
      });
    }
  }

  return departmentsByName;
}

async function assignUsersToDepartments(usersByEmail, departmentsByName) {
  const membership = {
    "manager@assetflow.demo": "Information Technology",
    "head@assetflow.demo": "Operations",
    "priya@assetflow.demo": "Information Technology",
    "raj@assetflow.demo": "Operations",
    "kunalpitale6@gmail.com": "Facilities",
  };

  for (const [email, departmentName] of Object.entries(membership)) {
    if (usersByEmail[email] && departmentsByName[departmentName]) {
      await prisma.user.update({
        where: { userId: usersByEmail[email] },
        data: { departmentId: departmentsByName[departmentName] },
      });
    }
  }
}

async function seedCategories() {
  const categoriesByName = {};

  for (const category of demoCategories) {
    const record = await prisma.assetCategory.upsert({
      where: { name: category.name },
      update: {
        description: category.description ?? null,
        customFields: category.customFields ?? undefined,
      },
      create: {
        name: category.name,
        description: category.description ?? null,
        customFields: category.customFields ?? undefined,
      },
      select: { categoryId: true, name: true },
    });

    categoriesByName[record.name] = record.categoryId;
  }

  return categoriesByName;
}

async function seedAssets(categoriesByName, registeredById) {
  for (const asset of demoAssets) {
    const customValues = {};
    if (asset.warrantyMonths !== undefined) customValues.warrantyMonths = asset.warrantyMonths;
    if (asset.capacity !== undefined) customValues.capacity = asset.capacity;

    const data = {
      name: asset.name,
      serialNumber: asset.serialNumber ?? null,
      categoryId: categoriesByName[asset.category],
      status: "Available",
      condition: asset.condition ?? null,
      location: asset.location ?? null,
      acquisitionDate: new Date("2024-01-15T00:00:00.000Z"),
      acquisitionCost: asset.acquisitionCost ?? null,
      isSharedResource: asset.isSharedResource ?? false,
      customValues: Object.keys(customValues).length ? customValues : undefined,
      registeredById,
    };

    await prisma.asset.upsert({
      where: { assetTag: asset.assetTag },
      update: data,
      create: { assetTag: asset.assetTag, ...data },
    });
  }
}

async function main() {
  console.log("Seeding AssetFlow demo data...");
  const usersByEmail = await seedUsers();
  const departmentsByName = await seedDepartments(usersByEmail);
  await assignUsersToDepartments(usersByEmail, departmentsByName);
  const categoriesByName = await seedCategories();
  await seedAssets(categoriesByName, usersByEmail["manager@assetflow.demo"]);

  console.log("Seed complete.");
  console.log(`  Users:        ${Object.keys(usersByEmail).length}`);
  console.log(`  Departments:  ${Object.keys(departmentsByName).length}`);
  console.log(`  Categories:   ${Object.keys(categoriesByName).length}`);
  console.log(`  Assets:       ${demoAssets.length}`);
  console.log("");
  console.log("Demo accounts:");
  for (const user of demoUsers) {
    console.log(`  ${user.role.padEnd(14)} ${user.email.padEnd(28)} ${user.password}`);
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
