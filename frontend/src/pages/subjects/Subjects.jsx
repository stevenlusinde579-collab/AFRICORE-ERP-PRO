import { useNavigate } from "react-router-dom";
import { useState } from "react";

import SubjectTable from "./SubjectTable";
import SubjectSearch from "./SubjectSearch";
import SubjectStatistics from "./SubjectStatistics";



function Subjects(){


const navigate = useNavigate();



const [filters,setFilters] = useState({

search:""

});







return (

<div className="p-6">





<div className="flex justify-between items-center mb-6">





<div>


<h1 className="text-3xl font-bold text-gray-800">

Subject Management

</h1>



<p className="text-gray-600 mt-2">

Manage school subjects in AfriCore ERP PRO

</p>



</div>







<button

onClick={()=>navigate("/subjects/add")}

className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"

>

+ Add Subject

</button>








</div>









<SubjectSearch

onSearch={setFilters}

/>








<SubjectStatistics/>









<SubjectTable

filters={filters}

/>









</div>

);


}



export default Subjects;