const PERMISSIONS = {
  CREATE_USER: "CREATE_USER",
  UPDATE_SELF_USER: "UPDATE_SELF_USER",
  UPDATE_USER: "UPDATE_USER",
  DELETE_USER: "DELETE_USER",
  CREATE_USER: "CREATE_USER",
  CREATE_USER: "CREATE_USER",
  CREATE_USER: "CREATE_USER",
};


const roles = {
  Employee: {
    inherits: [],
    permissions: ["read_profile"],
  },
  DepartmentHead: {
    inherits: [],
    permissions: ["read_profile"],
  },
  AssetManager: {
    inherits: ["user"],
    permissions: ["manage_team"],
  },
  Admin: {
    inherits: ["manager"],
    permissions: ["CreateUser", "Update"],
  },
};
