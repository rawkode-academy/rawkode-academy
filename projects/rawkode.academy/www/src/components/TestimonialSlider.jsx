import React, { useRef, useState } from "react";
import { FaQuoteLeft } from "react-icons/fa/index.js";
import SwiperCore, { Autoplay, Pagination } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";

const TestimonialSlider = ({ list }) => {
  SwiperCore.use([Pagination]);
  const [swiper, setSwiper] = useState(null);
  const paginationRef = useRef(null);

  return (
    <>
      <Swiper
        pagination={{
          type: "bullets",
          el: paginationRef.current,
          clickable: true,
          dynamicBullets: true,
        }}
        onSwiper={(swiper) => {
          setSwiper(swiper);
        }}
        loop={true}
        centeredSlides={true}
        modules={[Pagination, Autoplay]}
        // spaceBetween={20}
        autoplay={{ delay: 3000 }}
      >
        {list.map((item, index) => {
          return (
            <SwiperSlide key={"testimonial-" + index}>
              <div className="testimonial-content cursor-pointer px-8 py-16 text-center text-white">
                <FaQuoteLeft />
                <p className="mb-4 mt-8  leading-[1.75]">{item.content}</p>
                <span className="author mt-4">
                  <img src={item.avatar} alt="slider" />
                  <h3 className="h6">{item.author}</h3>
                  <p className="text-sm text-light">{item.profession}</p>
                </span>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
      <div className="relative mt-6 flex justify-center">
        <div className="pagination -translate-y-10" ref={paginationRef}></div>
      </div>
    </>
  );
};

export default TestimonialSlider;
