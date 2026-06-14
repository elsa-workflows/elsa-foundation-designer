"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useNav } from "@/components/app/nav-provider";

function titleize(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type Crumb = { label: string; href: string; clickable: boolean };

export function Breadcrumbs() {
  const pathname = usePathname();
  const { allLeaves, allParents } = useNav();

  const crumbs = useMemo<Crumb[]>(() => {
    const segments = pathname.split("/").filter(Boolean);
    const built: Crumb[] = [];
    let acc = "";
    for (const seg of segments) {
      acc += `/${seg}`;
      const leaf = allLeaves.find((n) => n.href === acc);
      const parent = allParents.find((p) => p.basePath === acc);
      if (leaf) {
        built.push({ label: leaf.title, href: leaf.href, clickable: true });
      } else if (parent) {
        // Parent groups have no landing page — show as plain text, not a link.
        built.push({ label: parent.title, href: acc, clickable: false });
      } else {
        built.push({ label: titleize(seg), href: acc, clickable: false });
      }
    }
    return built;
  }, [pathname, allLeaves, allParents]);

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.href}-${idx}`}>
              <BreadcrumbItem>
                {isLast || !crumb.clickable ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href}>{crumb.label}</Link>} />
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
