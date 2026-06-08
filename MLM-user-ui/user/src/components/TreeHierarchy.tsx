"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector } from "@/redux/hooks";

export interface TreeNode {
  id: string;
  name: string;
  avatar?: string;
  isCurrentUser?: boolean;
  children?: TreeNode[];
  count?: number;
  referralCode?: string;
}

interface TreeHierarchyProps {
  treeData: TreeNode;
}

export function TreeHierarchy({ treeData }: TreeHierarchyProps) {
  const user = useAppSelector((state) => state.auth.user);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);

  // Get current user's profile photo from localStorage (user-specific)
  useEffect(() => {
    if (typeof window !== "undefined" && user?.id) {
      const storedPhoto = localStorage.getItem(`profilePhoto_${user.id}`);
      if (storedPhoto) {
        setCurrentUserPhoto(storedPhoto);
        return;
      }
    }
    // Default profile photo
    setCurrentUserPhoto(
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&h=200&fit=crop&crop=faces",
    );
  }, [user?.id]);

  const calculateCount = (node: TreeNode): number => {
    if (!node.children || node.children.length === 0) return 0;
    return (
      node.children.length +
      node.children.reduce((sum, child) => sum + calculateCount(child), 0)
    );
  };

  const getNodePositions = () => {
    const positions: { [key: string]: { x: number; y: number } } = {};
    const levelHeight = 200;
    const minNodeSpacing = 180; // Minimum horizontal spacing between sibling nodes

    // Calculate subtree width recursively (bottom-up)
    const getSubtreeWidth = (node: TreeNode): number => {
      if (!node.children || node.children.length === 0) {
        return minNodeSpacing;
      }

      // Sum of all children's subtree widths
      const childrenWidth = node.children.reduce(
        (sum, child) => sum + getSubtreeWidth(child),
        0
      );

      // Add spacing between children
      const spacing = (node.children.length - 1) * minNodeSpacing;
      return Math.max(childrenWidth + spacing, minNodeSpacing);
    };

    // Recursive function to position nodes (top-down)
    const positionNode = (
      node: TreeNode,
      level: number,
      x: number
    ): number => {
      // Position current node
      positions[node.id] = {
        x,
        y: level * levelHeight,
        };

      if (!node.children || node.children.length === 0) {
        return x;
      }

      // Calculate starting x for children
      const subtreeWidth = getSubtreeWidth(node);
      const startX = x - subtreeWidth / 2;

      let currentX = startX;
      node.children.forEach((child) => {
        const childSubtreeWidth = getSubtreeWidth(child);
        const childX = currentX + childSubtreeWidth / 2;
        positionNode(child, level + 1, childX);
        currentX += childSubtreeWidth + minNodeSpacing;
      });

      return x;
    };

    // Start positioning from root at x=0
    positionNode(treeData, 0, 0);

    return positions;
  };

  const positions = getNodePositions();

  const renderNode = (node: TreeNode, nodeId: string) => {
    const pos = positions[nodeId];
    if (!pos) return null;

    const count = calculateCount(node);
    const isHighlighted = node.isCurrentUser;

    // Use profile photo for current user, otherwise use node.avatar or fallback to initial
    const avatarUrl =
      isHighlighted && currentUserPhoto
        ? currentUserPhoto
        : node.avatar || null;

    return (
      <g
        key={nodeId}
        transform={`translate(${Math.round(pos.x)}, ${Math.round(pos.y)})`}
      >
        {/* Avatar circle with highlight */}
        <circle
          cx={0}
          cy={0}
          r={isHighlighted ? 42 : 35}
          fill={isHighlighted ? "#3b82f6" : "white"}
          stroke={isHighlighted ? "#2563eb" : "#e5e7eb"}
          strokeWidth={isHighlighted ? 4 : 2}
          className="transition-all"
        />
        <circle
          cx={0}
          cy={0}
          r={30}
          fill="#f3f4f6"
          className="transition-all"
        />

        {/* User icon or avatar */}
        {avatarUrl ? (
          <>
            <image
              href={avatarUrl}
              x={-25}
              y={-25}
              width={50}
              height={50}
              clipPath="url(#avatar-clip)"
              className="object-cover"
            />
            {/* Fallback text if image fails to load - hidden by default */}
            <text
              x="0"
              y="8"
              textAnchor="middle"
              fontSize="20"
              fill="#6b7280"
              fontWeight="bold"
              stroke="none"
              vectorEffect="non-scaling-stroke"
              opacity="0"
            >
              <tspan>{node.name.charAt(0).toUpperCase()}</tspan>
            </text>
          </>
        ) : (
          <text
            x="0"
            y="8"
            textAnchor="middle"
            fontSize="20"
            fill="#6b7280"
            fontWeight="bold"
            stroke="none"
            vectorEffect="non-scaling-stroke"
          >
            <tspan>{node.name.charAt(0).toUpperCase()}</tspan>
          </text>
        )}

        {/* User ID with background for better readability */}
        <g>
          {/* Background rectangle for text to prevent overlap */}
          <rect
            x={-60}
            y={48}
            width={120}
            height={16}
            rx={4}
            fill="white"
            opacity="0.9"
            stroke="none"
          />
          <text
            x="0"
            y={60}
            textAnchor="middle"
            fontSize="11"
            fill="#111827"
            fontWeight="600"
            stroke="none"
            vectorEffect="non-scaling-stroke"
          >
            <tspan>
              {(node.referralCode || node.id).length > 12
                ? (node.referralCode || node.id).substring(0, 10) + "..."
                : node.referralCode || node.id}
            </tspan>
          </text>
        </g>
      </g>
    );
  };

  const renderConnections = (
    node: TreeNode,
    nodeId: string,
  ): React.ReactElement[] => {
    if (!node.children) return [];

    const parentPos = positions[nodeId];
    if (!parentPos) return [];

    const lines: React.ReactElement[] = [];

    node.children.forEach((child) => {
      const childId = child.id;
      const childPos = positions[childId];
      if (childPos) {
        lines.push(
          <line
            key={`${nodeId}-${childId}`}
            x1={parentPos.x}
            y1={parentPos.y + 35}
            x2={childPos.x}
            y2={childPos.y - 35}
            stroke="#d1d5db"
            strokeWidth="2"
            className="transition-all"
          />,
        );
        // Recursively render connections for children
        lines.push(...renderConnections(child, child.id));
      }
    });

    return lines;
  };

  const renderAllNodes = (
    node: TreeNode,
    nodeId: string,
  ): React.ReactElement[] => {
    const elements = [renderNode(node, nodeId)];
    if (node.children) {
      node.children.forEach((child) => {
        elements.push(...renderAllNodes(child, child.id));
      });
    }
    return elements.filter(Boolean) as React.ReactElement[];
  };

  const allNodes = renderAllNodes(treeData, treeData.id);
  const connections = renderConnections(treeData, treeData.id);

  // Calculate bounds for SVG - root node is at x=0, we want it centered
  const allX = Object.values(positions).map((p) => p.x);
  const allY = Object.values(positions).map((p) => p.y);
  const minX = Math.min(...allX) - 120;
  const maxX = Math.max(...allX) + 120;
  const minY = Math.min(...allY) - 80;
  const maxY = Math.max(...allY) + 120;
  const width = maxX - minX;
  const height = maxY - minY;
  // Since root is at x=0, translate by width/2 to center it
  const translateX = width / 2;
  const translateY = 80;

  return (
    <div
      className="w-full py-4 md:py-8"
      style={{ minWidth: `${width}px`, minHeight: `${height}px` }}
    >
      <div className="flex justify-center">
        <svg
          width={width}
          height={height}
          className="block"
          style={{
            shapeRendering: "geometricPrecision",
            minWidth: `${width}px`,
            minHeight: `${height}px`,
            display: "block",
          }}
        >
          {/* Define clip path for circular avatars */}
          <defs>
            <clipPath id="avatar-clip">
              <circle cx="0" cy="0" r="25" />
            </clipPath>
          </defs>
          <g
            transform={`translate(${Math.round(translateX)}, ${Math.round(translateY)})`}
          >
            {connections}
            {allNodes}
          </g>
        </svg>
      </div>
    </div>
  );
}
