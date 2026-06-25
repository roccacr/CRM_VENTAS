import { AppLayout } from "../../layout/AppLayout";
import { View_Kapso } from "../../views/kapso/View_Kapso";

export const Page_Kapso = () => {
   return (
      <AppLayout>
         <div className="pc-container">
            <div className="pc-content">
               <div className="row">
                  <View_Kapso />
               </div>
            </div>
         </div>
      </AppLayout>
   );
};
