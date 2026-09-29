import { useNavigate } from "react-router-dom";
import { useState } from "react";

import ClassTable from "./ClassTable";
import ClassSearch from "./ClassSearch";
import ClassStatistics from "./ClassStatistics";



function Classes(){


const navigate = useNavigate();



const [filters,setFilters] = useState({

search:""

});





return (

<div className="p-6">






<div className="flex justify-between items-center mb-6">





<div>


<h1 className="text-3xl font-bold text-gray-800">

Class Management

</h1>



<p className="text-gray-600 mt-2">

Manage all classes in AfriCore ERP PRO

</p>


</div>








<button

onClick={()=>navigate("/classes/add")}

className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"

>

+ Add Class

</button>







</div>









<ClassSearch

onSearch={setFilters}

/>









<ClassStatistics/>









<ClassTable

filters={filters}

/>








</div>

);


}



export default Classes;