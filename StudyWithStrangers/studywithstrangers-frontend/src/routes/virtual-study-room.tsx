import { createFileRoute } from "@tanstack/react-router";
import { SeoPage } from "@/components/studywithstrangers/SeoPage";
import { getSeoPage, seoHead } from "@/lib/seoPages";

const page = getSeoPage("virtual-study-room");

export const Route = createFileRoute("/virtual-study-room")({
  head: () => seoHead(page),
  component: () => <SeoPage page={page} />,
});
