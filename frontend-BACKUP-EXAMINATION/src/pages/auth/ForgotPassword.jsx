import { useState } from "react";
import { supabase } from "../../services/supabase";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

function ForgotPassword() {

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);


  const handleReset = async (e) => {

    e.preventDefault();

    try {

      setLoading(true);


      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            window.location.origin + "/reset-password",
        }
      );


      if(error) throw error;


      toast.success(
        "Password reset link sent to your email"
      );


    } catch(error){

      toast.error(
        error.message
      );

    } finally {

      setLoading(false);

    }

  };


  return (

    <div className="min-h-screen flex items-center justify-center bg-gray-100">

      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">


        <h1 className="text-2xl font-bold mb-4 text-center">
          Forgot Password
        </h1>


        <form onSubmit={handleReset}>


          <input

            type="email"

            placeholder="Enter your email"

            className="w-full border p-3 rounded mb-4"

            value={email}

            onChange={(e)=>setEmail(e.target.value)}

            required

          />


          <button

            disabled={loading}

            className="w-full bg-blue-700 text-white p-3 rounded"

          >

            {
              loading
              ?
              "Sending..."
              :
              "Send Reset Link"
            }


          </button>


        </form>


        <div className="text-center mt-4">

          <Link
            to="/login"
            className="text-blue-600"
          >
            Back to Login
          </Link>

        </div>


      </div>

    </div>

  );

}


export default ForgotPassword;