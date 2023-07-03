import { FieldAccess } from "payload/types";

export const readOnlyField: FieldAccess<{ id: string }, unknown, unknown> = ({
  req: { user },
}) => {
  return false;
};
