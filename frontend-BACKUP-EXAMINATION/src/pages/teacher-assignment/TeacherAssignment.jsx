import { useNavigate } from "react-router-dom";
import AssignmentTable from "./AssignmentTable";


function TeacherAssignment(){


const navigate = useNavigate();




return (

<div className="p-6">





<div className="flex justify-between items-center mb-6">





<div>


<h1 className="text-3xl font-bold text-gray-800">

Teacher Assignment

</h1>


<p className="text-gray-600 mt-2">

Assign teachers to subjects and classes

</p>


</div>







<button

onClick={()=>navigate("/teacher-assignment/add")}

className="bg-blue-600 text-white px-6 py-3 rounded-lg"

>

+ Add Assignment

</button>







</div>









<AssignmentTable/>








</div>

);


}


export default TeacherAssignment;