import { useEffect, useState } from "react";

export function useAturData() {
    const [data, setData] = useState(() => window.atur?.data);
    useEffect(() => {
        window.atur?.onDataChange?.((next) => setData(next));
    }, []);
    return data;
}
