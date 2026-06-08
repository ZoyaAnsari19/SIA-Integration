import { apiClient } from './client';

interface CourseByPackageResponse {
  course: {
    id: string;
    slug: string;
    title: string;
    package_id?: number | null;
    price?: number;
  };
}

/**
 * Resolve primary published course linked to a package.
 * Used by dashboard \"Buy More\" flow to redirect users to the course app.
 */
export async function getCourseByPackageId(packageId: number) {
  const response = await apiClient.get<CourseByPackageResponse>(
    `/courses/by-package/${packageId}`,
  );
  return response.data.course;
}

