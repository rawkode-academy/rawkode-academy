import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { actions } from "astro:actions";
import { DataTable } from "../common/DataTable";
import { ErrorMessage } from "../common/ErrorMessage";
import { Spinner } from "../common/Spinner";
import DeleteLivestreamDialog from "./delete-livestream-dialog";

type Room = {
  id: string;
  name: string;
};

const columns: ColumnDef<Room>[] = [
  {
    header: "ID",
    accessorFn: (row) => row.id,
  },
  {
    header: "Name",
    accessorFn: (row) => row.name,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <DeleteLivestreamDialog name={row.original.name} />;
    },
  },
];

export default function ActiveLivestreamPage() {
  const { isPending, isError, data, error } = useQuery({
    queryKey: ["livestreams"],
    queryFn: async () => {
      const { data, error } = await actions.listRooms();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  if (isPending) {
    return <Spinner />;
  }

  if (isError) {
    return <ErrorMessage error={error} />;
  }

  return <DataTable columns={columns} data={data} />;
}
