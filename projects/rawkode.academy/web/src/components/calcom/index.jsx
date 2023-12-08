import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

export default function BookTime() {
	useEffect(() => {
		(async function () {
			const cal = await getCalApi();
			cal("ui", { "styles": { "branding": { "brandColor": "#5F5ED7" } }, "hideEventTypeDetails": true, "layout": "month_view" });
		})();
	}, [])

	return <Cal
		calLink="rawkode/office-hours"
		style={{ width: "100%", height: "100%", overflow: "scroll" }}
		config={{ layout: 'month_view' }}
	/>;
};
