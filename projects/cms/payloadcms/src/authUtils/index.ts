export const isAdmin = ({ req: { user } }) => user.role === "admin";
