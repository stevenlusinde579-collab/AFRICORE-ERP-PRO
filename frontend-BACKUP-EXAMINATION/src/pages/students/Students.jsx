import { useNavigate } from "react-router-dom";
import StudentTable from "./StudentTable";
import StudentSearch from "./StudentSearch";
import StudentStatistics from "./StudentStatistics";
import { useState } from "react";


function Students(){

const navigate = useNavigate();


const [filters,setFilters] = useState({

search:"",
gender:"",
status:""

});



return (

<div className="p-6">


<div className="flex justify-between items-center mb-6">


<div>

<h1 className="text-3xl font-bold text-gray-800">

Student Management

</h1>


<p className="text-gray-600 mt-2">

Manage students in AfriCore ERP PRO

</p>


</div>





<button

onClick={()=>navigate("/students/add")}

className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"

>

+ Add Student

</button>



</div>






<StudentSearch

onSearch={setFilters}

/>






<StudentStatistics/>







<StudentTable

filters={filters}

/>





</div>

);


}


export default Students;