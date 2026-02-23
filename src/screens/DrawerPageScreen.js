import React from "react";
import { PlaceholderScreen } from "./PlaceholderScreen";

export function DrawerPageScreen({ route }) {
  const title = route?.params?.title || "Page";
  const subtitle =
    route?.params?.subtitle ||
    "This screen belongs to the home drawer and is accessible only from Home.";

  return <PlaceholderScreen title={title} subtitle={subtitle} />;
}
