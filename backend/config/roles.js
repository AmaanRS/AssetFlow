const PERMISSIONS = {
  CREATE_USER: "create:user",
  UPDATE_USER: "update:user",
  DELETE_USER: "delete:user",
  CREATE_ASSET: "create:asset",
  READ_ASSET: "read:asset",
  UPDATE_ASSET: "update:asset",
  DELETE_ASSET: "delete:asset",
  ALLOCATE_ASSET: "allocate:asset",
  TRANSFER_ASSET: "transfer:asset",
  APPROVE_ASSET_TRANSFER: "approve:asset-transfer",
};

const roles = {
  Employee: {
    inherits: [],
    permissions: [PERMISSIONS.READ_ASSET, PERMISSIONS.TRANSFER_ASSET],
  },
  DepartmentHead: {
    inherits: ["Employee"],
    permissions: [PERMISSIONS.APPROVE_ASSET_TRANSFER],
  },
  AssetManager: {
    inherits: ["Employee"],
    permissions: [
      PERMISSIONS.CREATE_ASSET,
      PERMISSIONS.UPDATE_ASSET,
      PERMISSIONS.DELETE_ASSET,
      PERMISSIONS.ALLOCATE_ASSET,
      PERMISSIONS.APPROVE_ASSET_TRANSFER,
    ],
  },
  Admin: {
    inherits: ["DepartmentHead", "AssetManager"],
    permissions: [
      PERMISSIONS.CREATE_USER,
      PERMISSIONS.UPDATE_USER,
      PERMISSIONS.DELETE_USER,
    ],
  },
};
