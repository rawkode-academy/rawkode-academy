import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

interface Props {
	link: string;
}

export default (props: Props) => {
	useEffect(() => {
		(async () => {
			const cal = await getCalApi();
			cal("ui", {
				styles: { branding: { brandColor: "#5F5ED7" } },
				hideEventTypeDetails: true,
				layout: "month_view",
			});
		})();
	}, []);

	return (
		<Cal
			calLink={`RawkodeAcademy/${props.link}`}
			style={{ width: "100%", height: "100%", overflow: "scroll" }}
			config={{ layout: "month_view" }}
		/>
	);
};
