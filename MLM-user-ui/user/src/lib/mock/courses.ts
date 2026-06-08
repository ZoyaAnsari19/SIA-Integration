const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_COURSES: Record<number, { id: string; slug: string; title: string; package_id: number; price: number }> = {
  1: { id: "course-starter-001", slug: "starter-investment", title: "Starter Investment Course", package_id: 1, price: 15000 },
  2: { id: "course-growth-002", slug: "growth-investment", title: "Growth Investment Course", package_id: 2, price: 30000 },
  3: { id: "course-premium-003", slug: "premium-investment", title: "Premium Investment Course", package_id: 3, price: 50000 },
};

export async function getCourseByPackageId(packageId: number) {
  await delay();
  const course = MOCK_COURSES[packageId];
  if (!course) {
    throw new Error("No course linked to this package (demo)");
  }
  return structuredClone(course);
}
