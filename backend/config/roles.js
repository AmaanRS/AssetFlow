const PERMISSIONS = {
  CREATE_USER: "create:user",
  READ_USER: "read:user",
  UPDATE_USER: "update:user",
  DELETE_USER: "delete:user",
  CREATE_ASSET: "create:asset",
  READ_ASSET: "read:asset",
  READ_OWN_ALLOCATION: "read:own-allocation",
  UPDATE_ASSET: "update:asset",
  DELETE_ASSET: "delete:asset",
  ALLOCATE_ASSET: "allocate:asset",
  APPROVE_ASSET_ALLOCATION: "approve:asset-allocation",
  TRANSFER_ASSET: "transfer:asset",
  APPROVE_ASSET_TRANSFER: "approve:asset-transfer",
  BOOK_SHARED_RESOURCE: "book:shared-resource",
  BOOK_DEPARTMENT_RESOURCE: "book:department-resource",
  RAISE_MAINTENANCE_REQUEST: "raise:maintenance-request",
  APPROVE_MAINTENANCE_REQUEST: "approve:maintenance-request",
  RAISE_ASSET_RETURN: "raise:asset-return",
  APPROVE_ASSET_RETURN: "approve:asset-return",
};

const roles = {
  Employee: {
    inherits: [],
    permissions: [
      PERMISSIONS.READ_ASSET,
      PERMISSIONS.READ_OWN_ALLOCATION,
      PERMISSIONS.BOOK_SHARED_RESOURCE,
      PERMISSIONS.RAISE_MAINTENANCE_REQUEST,
      PERMISSIONS.RAISE_ASSET_RETURN,
      PERMISSIONS.TRANSFER_ASSET,
    ],
  },
  DepartmentHead: {
    inherits: ["Employee"],
    permissions: [
      PERMISSIONS.APPROVE_ASSET_ALLOCATION,
      PERMISSIONS.APPROVE_ASSET_TRANSFER,
      PERMISSIONS.BOOK_DEPARTMENT_RESOURCE,
    ],
  },
  AssetManager: {
    inherits: ["Employee"],
    permissions: [
      PERMISSIONS.CREATE_ASSET,
      PERMISSIONS.UPDATE_ASSET,
      PERMISSIONS.DELETE_ASSET,
      PERMISSIONS.ALLOCATE_ASSET,
      PERMISSIONS.APPROVE_ASSET_TRANSFER,
      PERMISSIONS.APPROVE_MAINTENANCE_REQUEST,
      PERMISSIONS.APPROVE_ASSET_RETURN,
    ],
  },
  Admin: {
    inherits: ["DepartmentHead", "AssetManager"],
    permissions: [
      PERMISSIONS.CREATE_USER,
      PERMISSIONS.READ_USER,
      PERMISSIONS.UPDATE_USER,
      PERMISSIONS.DELETE_USER,
    ],
  },
};

function hasPermission(roleName, permission, visitedRoles = new Set()) {
  if (visitedRoles.has(roleName)) {
    return false;
  }

  const role = roles[roleName];

  if (!role) {
    return false;
  }

  if (role.permissions.includes(permission)) {
    return true;
  }

  visitedRoles.add(roleName);

  return role.inherits.some((inheritedRole) =>
    hasPermission(inheritedRole, permission, visitedRoles),
  );
}

export { hasPermission, PERMISSIONS, roles };
