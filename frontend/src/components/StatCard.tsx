import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    Typography,
} from "@mui/material";

import type { ReactNode } from "react";

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: ReactNode;
    icon: ReactNode;
    onClick?: () => void;
}

export default function StatCard({
    title,
    value,
    subtitle,
    icon,
    onClick,
}: StatCardProps) {
    const content = (
        <CardContent>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 2,
                }}
            >
                <Box
                    sx={{
                        flex: 1,
                        minWidth: 0,
                    }}
                >
                    <Typography
                        variant="body2"
                        color="text.secondary"
                    >
                        {title}
                    </Typography>

                    <Typography
                        variant="h4"
                        sx={{
                            mt: 1,
                            mb: subtitle ? 1 : 0,
                        }}
                    >
                        {value}
                    </Typography>

                    {subtitle}
                </Box>

                <Box
                    sx={{
                        fontSize: 42,
                        color: "primary.main",
                        display: "flex",
                        alignItems: "center",
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </Box>
            </Box>
        </CardContent>
    );

    return (
        <Card
            elevation={2}
            sx={{
                height: "100%",
            }}
        >
            {onClick ? (
                <CardActionArea
                    onClick={onClick}
                    sx={{ height: "100%" }}
                >
                    {content}
                </CardActionArea>
            ) : (
                content
            )}
        </Card>
    );
}
