import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";

import StatCard from "./StatCard";

interface ProgressStatCardProps {
    title: string;
    value: string;
    subtitle: string;
    progress: number;
    icon: ReactNode;
}

export default function ProgressStatCard({
    title,
    value,
    subtitle,
    progress,
    icon,
}: ProgressStatCardProps) {
    return (
        <StatCard
            title={title}
            value={value}
            subtitle={
                <Box>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                    >
                        {subtitle}
                    </Typography>

                    <LinearProgress
                        variant="determinate"
                        value={Math.min(Math.max(progress, 0), 100)}
                        sx={{
                            mt: 1,
                            borderRadius: 999,
                            height: 8,
                        }}
                    />
                </Box>
            }
            icon={icon}
        />
    );
}
