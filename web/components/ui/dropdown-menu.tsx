"use client";
import * as React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuSub = Menu.Sub;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "animate-pop-in z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-fg outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-hover [&_svg]:size-4 [&_svg]:text-fg-muted",
        danger && "text-danger data-[highlighted]:bg-danger-subtle [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Menu.CheckboxItem>) {
  return (
    <Menu.CheckboxItem
      className={cn(
        "relative flex min-h-9 cursor-pointer items-center rounded-sm py-1.5 pr-2.5 pl-8 text-sm text-fg outline-none select-none data-[highlighted]:bg-surface-hover",
        className,
      )}
      {...props}
    >
      <Menu.ItemIndicator className="absolute left-2.5 inline-flex">
        <Check className="size-4 text-brand" aria-hidden />
      </Menu.ItemIndicator>
      {children}
    </Menu.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn("px-2.5 py-1.5 text-xs font-semibold tracking-wide text-fg-muted uppercase", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}
