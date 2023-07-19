import { humanize } from "@lib/utils/textConverter";
import React, { useRef, useState } from "react";
import * as Icon from "react-feather";
import SwiperCore, { Autoplay, Pagination } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";

const FeatureSlider = ({ features }) => {
  SwiperCore.use([Pagination]);
  const [swiper, setSwiper] = useState(null);
  const paginationRef = useRef(null);

  return (
    <div className="relative">
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
        modules={[Pagination, Autoplay]}
        slidesPerView={1}
        breakpoints={{
          992: {
            slidesPerView: 2,
          },
          1200: {
            slidesPerView: 3,
          },
        }}
        // spaceBetween={20}
        // autoplay={{ delay: 3000 }}
      >
        {features.list.map((item, index) => {
          const FeatherIcon = Icon[humanize(item.icon)];
          return (
            <SwiperSlide key={"feature-" + index}>
              <div className="features-card group z-30 cursor-pointer">
                <div className="icon flex items-center justify-center text-primary group-hover:bottom-0 group-hover:top-auto  group-hover:duration-100 group-hover:ease-in group-hover:after:h-full">
                  <FeatherIcon />
                </div>
                <h3 className="h5 mb-5 mt-6">{item.title}</h3>
                <p>{item.content}</p>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
      <div className="relative mt-9 flex justify-center">
        <div
          width="100%"
          className="pagination "
          style={{ width: "100%" }}
          ref={paginationRef}
        ></div>
      </div>
    </div>
  );
};

export default FeatureSlider;
