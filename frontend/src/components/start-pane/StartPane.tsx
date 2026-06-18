// import React from "react";
// import ImageUpload from "../ImageUpload";
// import { UrlInputSection } from "../UrlInputSection";
// import ImportCodeSection from "../ImportCodeSection";
// import { Settings } from "../../types";
// import { Stack } from "../../lib/stacks";

// interface Props {
//   doCreate: (images: string[], inputMode: "image" | "video") => void;
//   importFromCode: (code: string, stack: Stack) => void;
//   settings: Settings;
// }

// const StartPane: React.FC<Props> = ({ doCreate, importFromCode, settings }) => {
//   return (
//     <div className="flex flex-col justify-center items-center gap-y-10">
//       <ImageUpload setReferenceImages={doCreate} />
//       <UrlInputSection
//         doCreate={doCreate}
//         screenshotOneApiKey={settings.screenshotOneApiKey}
//       />
//       <ImportCodeSection importFromCode={importFromCode} />
//     </div>
//   );
// };

// export default StartPane;


import React from "react";
import ImageUpload from "../ImageUpload";
// import { UrlInputSection } from "../UrlInputSection";
// import ImportCodeSection from "../ImportCodeSection";
import { Settings } from "../../types";
import { Stack } from "../../lib/stacks";

interface Props {
  doCreate: (images: string[], inputMode: "image" | "video") => void;
  importFromCode: (code: string, stack: Stack) => void;
  settings: Settings;
}

// We only destructure 'doCreate' because the other props are for features we just hid.
const StartPane: React.FC<Props> = ({ doCreate /*, importFromCode, settings */ }) => {
  return (
    <div className="flex flex-col justify-center items-center gap-y-10">
      {/* 1. Image Upload Area (KEPT) */}
      <ImageUpload setReferenceImages={doCreate} />

      {/* 
        2. Screenshot URL Section (HIDDEN) 
        <UrlInputSection
          doCreate={doCreate}
          screenshotOneApiKey={settings.screenshotOneApiKey}
        />
      */}

      {/* 
        3. Import Code Section (HIDDEN)
        <ImportCodeSection importFromCode={importFromCode} />
      */}
    </div>
  );
};

export default StartPane;