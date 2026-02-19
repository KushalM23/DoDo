export type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type CategoryDto = {
  id: string;
  name: string;
  createdAt: string;
};

export function toCategoryDto(row: CategoryRow): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}
