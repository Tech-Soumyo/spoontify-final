import Image from "next/image";
import img from "../../../public/interior.jpg";

function page() {
  return (
    <div className="relative min-h-screen w-full">
      {/* Background Image */}
      <Image
        src={img}
        alt="Interior background"
        fill
        className="object-cover"
        quality={100}
      />

      {/* Content Container with glass effect overlay */}
      <div className="relative h-full min-h-screen  bg-white/10">
        <div className="container mx-auto p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Sidebar with queue section & play section */}
            <div className="backdrop-blur-md bg-black/20 rounded-2xl w-full lg:w-64 h-64 lg:min-h-[90vh] mt-4 border border-white/30 shadow-lg">
              <div className="p-4">
                <h1 className="text-2xl font-bold text-white/90 text-center">
                  SPOONIFY
                </h1>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              {/* Search bar */}
              <div className="backdrop-blur-md bg-white/20 rounded-xl h-12 w-full p-4 my-4 border border-white/30 shadow-lg">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full h-full bg-transparent text-white/90 placeholder-white/70 outline-none text-center"
                />
              </div>

              {/* Chat area */}
              <div className="backdrop-blur-md bg-white/20 rounded-2xl flex-1 w-full min-h-[70vh] border border-white/30 shadow-lg p-4">
                {/* Rooommates Chats */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default page;
